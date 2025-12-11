"""
Main application for Irrigation Scheduling.
"""

import sys
from datetime import datetime, timedelta
from typing import List, Optional
from models import Field, WeatherData
from calculator import calculate_etc_for_all_fields
from formatter import format_etc_table
import database


class IrrigationApp:
    """
    Main application class for managing irrigation scheduling.
    """
    
    def __init__(self, db_path: str = "irrigation.db"):
        """Initialize the application with database."""
        self.db_path = db_path
        database.init_database(self.db_path)
        database.initialize_default_fields(self.db_path)
    
    def get_next_three_dates(self) -> List[str]:
        """
        Get the next three consecutive dates starting from tomorrow.
        
        Returns:
            List of ISO 8601 formatted date strings
        """
        today = datetime.now()
        dates = []
        for i in range(1, 4):  # Next 3 days (tomorrow, day after, etc.)
            date = today + timedelta(days=i)
            dates.append(date.strftime("%Y-%m-%d"))
        return dates
    
    def validate_et0_input(self, value: str) -> Optional[float]:
        """
        Validate and convert ET0 input string to float.
        
        Args:
            value: User input string
            
        Returns:
            Float value if valid, None otherwise
        """
        try:
            float_value = float(value.strip())
            if float_value < 0:
                return None
            return float_value
        except (ValueError, AttributeError):
            return None
    
    def validate_crop_factor_input(self, value: str) -> Optional[float]:
        """
        Validate and convert crop factor input string to float.
        
        Args:
            value: User input string
            
        Returns:
            Float value if valid, None otherwise
        """
        try:
            float_value = float(value.strip())
            if float_value < 0:
                return None
            return float_value
        except (ValueError, AttributeError):
            return None
    
    def validate_fertilizer_week_input(self, value: str) -> Optional[int]:
        """
        Validate and convert fertilizer week input string to int.
        
        Args:
            value: User input string
            
        Returns:
            Integer value if valid, None otherwise
        """
        try:
            int_value = int(value.strip())
            if int_value < 1:
                return None
            return int_value
        except (ValueError, AttributeError):
            return None
    
    def _calculate_and_save_etc_for_dates(self, dates: List[str]):
        """
        Calculate and save ETc values for all fields and specified dates.
        
        Args:
            dates: List of date strings in ISO 8601 format (YYYY-MM-DD)
            
        Returns:
            Tuple of (success: bool, etc_results: dict, valid_fields: List[Field], weather_data: List[WeatherData])
            Returns (False, None, None, None) on failure
        """
        try:
            # Get fields from database
            fields = database.get_all_fields(self.db_path)
            if not fields:
                return (False, None, None, None)
            
            # Get weather data for specified dates
            weather_data = database.get_weather_data_by_dates(self.db_path, dates)
            
            # Check if we have weather data for all dates
            if len(weather_data) != len(dates):
                return (False, None, None, None)
            
            # Verify that all requested dates are present in weather_data
            weather_dates = {wd.date for wd in weather_data}
            if weather_dates != set(dates):
                return (False, None, None, None)
            
            # Filter out fields with invalid crop factors
            valid_fields = [
                field for field in fields 
                if field.crop_factor is not None and field.crop_factor >= 0
            ]
            
            if not valid_fields:
                return (False, None, None, None)
            
            # Calculate ETc for all valid fields
            etc_results = calculate_etc_for_all_fields(valid_fields, weather_data)
            
            # Save ETc calculations to database
            database.save_etc_calculations_batch(self.db_path, etc_results, weather_data)
            
            return (True, etc_results, valid_fields, weather_data)
        except Exception:
            # Silently handle errors - don't interrupt user flow
            return (False, None, None, None)
    
    def input_weather_data(self):
        """Prompt user to enter ET0 values for the next three dates."""
        dates = self.get_next_three_dates()
        
        print("\n=== Enter Weather Data ===")
        print("Please enter ET0 (reference evapotranspiration) values for each date.")
        print("Date format: ISO 8601 (YYYY-MM-DD)")
        print()
        
        for date in dates:
            while True:
                try:
                    et0_input = input(f"Enter ET0 for {date} (mm/day): ").strip()
                    et0_value = self.validate_et0_input(et0_input)
                    
                    if et0_value is None:
                        print(f"Error: Invalid ET0 value for {date}. Please enter a non-negative number.")
                        continue
                    
                    database.save_weather_data(self.db_path, date, et0_value)
                    break
                except ValueError as e:
                    print(f"Error: {e}")
                    continue
        
        # Calculate and save ETc values immediately after entering ET0 values
        success, _, _, _ = self._calculate_and_save_etc_for_dates(dates)
        if success:
            print("\nETc values have been calculated and saved.")
        else:
            # Silently fail - calculation will happen when viewing table if needed
            pass
    
    def display_main_menu(self):
        """Display the main menu options."""
        print("\n" + "="*50)
        print("IRRIGATION SCHEDULING APPLICATION")
        print("="*50)
        print("\nMain Menu:")
        print("1. View Fields")
        print("2. Add Field")
        print("3. Edit Field")
        print("4. Delete Field")
        print("5. Enter Weather Data (ET0)")
        print("6. View ETc Table")
        print("7. Exit")
        print()
    
    def display_fields(self):
        """Display all fields in a formatted table."""
        fields = database.get_all_fields(self.db_path)
        if not fields:
            print("\nError: No fields provided. Please enter at least one field.")
            return
        
        print("\n=== Fields ===")
        print(f"{'Field Name':<15} {'Crop Factor':<15} {'Fertilizer Week':<15}")
        print("-" * 50)
        for field in sorted(fields, key=lambda f: f.field_name):
            print(f"{field.field_name:<15} {field.crop_factor:<15.2f} {field.fertilizer_week:<15}")
    
    def add_field(self):
        """Prompt user to add a new field."""
        print("\n=== Add Field ===")
        
        # Get field name
        while True:
            field_name = input("Enter field name: ").strip()
            if not field_name:
                print("Error: Field name cannot be empty.")
                continue
            
            # Check for duplicate
            if database.field_exists(self.db_path, field_name):
                print(f"Error: Field '{field_name}' already exists.")
                continue
            
            break
        
        # Get crop factor
        while True:
            crop_factor_input = input("Enter crop factor (Kc): ").strip()
            crop_factor = self.validate_crop_factor_input(crop_factor_input)
            if crop_factor is None:
                print("Error: Crop factor must be a non-negative number.")
                continue
            break
        
        # Get fertilizer week
        while True:
            fertilizer_week_input = input("Enter fertilizer week: ").strip()
            fertilizer_week = self.validate_fertilizer_week_input(fertilizer_week_input)
            if fertilizer_week is None:
                print("Error: Fertilizer week must be a positive integer.")
                continue
            break
        
        try:
            database.create_field(self.db_path, field_name, crop_factor, fertilizer_week)
            print(f"\nSuccessfully added field '{field_name}'.")
        except Exception as e:
            print(f"Error: {e}")
    
    def edit_field(self):
        """Prompt user to edit an existing field."""
        fields = database.get_all_fields(self.db_path)
        if not fields:
            print("\nError: No fields available to edit.")
            return
        
        print("\n=== Edit Field ===")
        self.display_fields()
        
        field_name = input("\nEnter field name to edit: ").strip()
        field = database.get_field(self.db_path, field_name)
        
        if not field:
            print(f"Error: Field '{field_name}' not found.")
            return
        
        print(f"\nCurrent values for '{field_name}':")
        print(f"  Crop Factor: {field.crop_factor}")
        print(f"  Fertilizer Week: {field.fertilizer_week}")
        
        # Get new crop factor
        while True:
            crop_factor_input = input("\nEnter new crop factor (press Enter to keep current): ").strip()
            if not crop_factor_input:
                new_crop_factor = field.crop_factor
                break
            new_crop_factor = self.validate_crop_factor_input(crop_factor_input)
            if new_crop_factor is None:
                print("Error: Crop factor must be a non-negative number.")
                continue
            break
        
        # Get new fertilizer week
        while True:
            fertilizer_week_input = input("Enter new fertilizer week (press Enter to keep current): ").strip()
            if not fertilizer_week_input:
                new_fertilizer_week = field.fertilizer_week
                break
            new_fertilizer_week = self.validate_fertilizer_week_input(fertilizer_week_input)
            if new_fertilizer_week is None:
                print("Error: Fertilizer week must be a positive integer.")
                continue
            break
        
        try:
            database.update_field(self.db_path, field_name, new_crop_factor, new_fertilizer_week)
            print(f"\nSuccessfully updated field '{field_name}'.")
        except Exception as e:
            print(f"Error: {e}")
    
    def delete_field(self):
        """Prompt user to delete a field."""
        fields = database.get_all_fields(self.db_path)
        if not fields:
            print("\nError: No fields available to delete.")
            return
        
        print("\n=== Delete Field ===")
        self.display_fields()
        
        field_name = input("\nEnter field name to delete: ").strip()
        
        if not database.field_exists(self.db_path, field_name):
            print(f"Error: Field '{field_name}' not found.")
            return
        
        confirm = input(f"Are you sure you want to delete '{field_name}'? (yes/no): ").strip().lower()
        if confirm == 'yes':
            try:
                database.delete_field(self.db_path, field_name)
                print(f"\nSuccessfully deleted field '{field_name}'.")
            except Exception as e:
                print(f"Error: {e}")
        else:
            print("Deletion cancelled.")
    
    def view_etc_table(self):
        """Calculate and display ETc table."""
        # Get fields from database
        fields = database.get_all_fields(self.db_path)
        if not fields:
            print("\nError: No fields provided. Please enter at least one field.")
            return
        
        # Get weather data for next three dates
        dates = self.get_next_three_dates()
        weather_data = database.get_weather_data_by_dates(self.db_path, dates)
        
        # Check for missing dates
        missing_dates = []
        for date in dates:
            if not any(wd.date == date for wd in weather_data):
                missing_dates.append(date)
        
        if missing_dates:
            for date in missing_dates:
                print(f"Error: Missing ET0 value for {date}. Please enter a value.")
            return
        
        # Validate crop factors
        invalid_fields = []
        for field in fields:
            if field.crop_factor is None or field.crop_factor < 0:
                invalid_fields.append(field.field_name)
        
        if invalid_fields:
            for field_name in invalid_fields:
                print(f"Error: Crop factor for '{field_name}' is invalid. Please enter a float value.")
            return
        
        # Calculate and save ETc using helper method
        success, etc_results, valid_fields, weather_data = self._calculate_and_save_etc_for_dates(dates)
        if not success:
            print("Error: Could not calculate ETc values.")
            return
        
        # Display table using results from helper method
        try:
            print("\n=== ETc Table ===")
            print("\nDate format: ISO 8601 (YYYY-MM-DD)")
            print()
            table = format_etc_table(valid_fields, weather_data, etc_results)
            print(table)
        except Exception as e:
            print(f"Error displaying ETc table: {e}")
    
    def run(self):
        """Run the main application loop."""
        print("Welcome to the Irrigation Scheduling Application!")
        
        while True:
            self.display_main_menu()
            choice = input("Select an option (1-7): ").strip()
            
            if choice == '1':
                self.display_fields()
            elif choice == '2':
                self.add_field()
            elif choice == '3':
                self.edit_field()
            elif choice == '4':
                self.delete_field()
            elif choice == '5':
                self.input_weather_data()
            elif choice == '6':
                self.view_etc_table()
            elif choice == '7':
                print("\nThank you for using the Irrigation Scheduling Application. Goodbye!")
                sys.exit(0)
            else:
                print("\nInvalid option. Please select 1-7.")


def main():
    """Entry point for the application."""
    app = IrrigationApp()
    app.run()


if __name__ == "__main__":
    main()


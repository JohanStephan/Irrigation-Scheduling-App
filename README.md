# Irrigation Scheduling Application

A Python application for scheduling irrigation.

## Features

- **Field Management**: Add, edit, and delete fields with crop factors
- **Weather Data Entry**: Enter ET0 values for the next three dates
- **ETc Calculation**: Automatically calculates ETc = ET0 × crop_factor for each field
- **Table View**: Displays ETc results in a markdown-formatted table

## Requirements

- Python 3.6 or higher
- Compatible with macOS (tested on MacBook Pro M4)

## Installation

No external dependencies required - uses only Python standard library.

## Usage

Run the application:

```bash
python3 app.py
```

### Main Menu Options

1. **View Fields**: Display all fields and their attributes
2. **Add Field**: Add a new field with name, crop factor, and fertilizer week
3. **Edit Field**: Modify crop factor or fertilizer week for an existing field
4. **Delete Field**: Remove a field from the system
5. **Enter Weather Data (ET0)**: Input ET0 values for the next three dates
6. **View ETc Table**: Display calculated ETc values in a markdown table
7. **Exit**: Close the application

### Default Fields

The application comes pre-populated with three fields:
- DF1B
- SS2B
- MF8B

You can edit these fields to add crop factors and fertilizer weeks.

### Date Format

All dates use ISO 8601 format: `YYYY-MM-DD` (e.g., `2024-06-15`)

### ETc Calculation

ETc (Evapotranspiration Crop) is calculated using the formula:
```
ETc = ET0 × Kc (crop_factor)
```

Where:
- **ET0**: Reference evapotranspiration (mm/day)
- **Kc**: Crop coefficient (crop_factor)

## Data Models

### Field Class

```python
Field(
    field_name: str,      # Name of the field
    crop_factor: float,   # Crop coefficient (Kc)
    fertilizer_week: int  # Week number for fertilizer application
)
```

### WeatherData Class

```python
WeatherData(
    date: str,   # Date in ISO 8601 format (YYYY-MM-DD)
    et0: float   # Reference evapotranspiration (mm/day)
)
```

## Error Handling

The application validates all inputs and provides clear error messages:

- Missing ET0 values for required dates
- Invalid crop factors (must be non-negative numbers)
- Invalid field names (must be non-empty strings)
- Missing fields (at least one field required)

## Example Workflow

1. Launch the application: `python3 app.py`
2. Edit fields to set crop factors (Menu option 3)
3. Enter weather data for the next three dates (Menu option 5)
4. View the ETc table to see calculated values (Menu option 6)

## Notes

- Fields are sorted alphabetically in the ETc table
- The application automatically calculates the next three dates starting from tomorrow


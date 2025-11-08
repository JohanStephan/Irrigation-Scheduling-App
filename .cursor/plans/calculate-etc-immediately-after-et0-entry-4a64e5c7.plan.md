<!-- 4a64e5c7-eab2-48ca-bc16-9deed7d9a3d7 84513d40-4647-4753-a9b7-4c5e69ab783f -->
# Calculate ETc Immediately After ET0 Entry

## Current Behavior

- ET0 values are saved in `input_weather_data()` method (app.py:93-116)
- ETc calculations only occur when user selects "View ETc Table" option (app.py:265-313)
- The calculation logic is embedded in `view_etc_table()` method

## Implementation Plan

### 1. Extract ETc Calculation Logic

Create a new helper method `_calculate_and_save_etc_for_dates()` in the `IrrigationApp` class that:

- Takes a list of dates as parameter
- Gets all fields from database
- Gets weather data for the specified dates
- Validates fields (skip invalid crop factors silently)
- Calculates ETc for all valid field-date combinations using `calculate_etc_for_all_fields()`
- Saves results to database using `database.save_etc_calculations_batch()`
- Handles errors gracefully (logs errors but doesn't interrupt user flow)

### 2. Modify `input_weather_data()` Method

After the loop that saves all three ET0 values completes:

- Call the new helper method with the three dates
- Handle any errors gracefully with user-friendly messages

### 3. Optional: Refactor `view_etc_table()` Method

Refactor `view_etc_table()` to use the new helper method for calculation, keeping the display logic separate. This eliminates code duplication.

## Files to Modify

- `app.py`: Add helper method and modify `input_weather_data()`, optionally refactor `view_etc_table()`

## Implementation Details

- The helper method should validate that weather data exists for the dates before calculating
- Invalid fields (missing/invalid crop factors) should be skipped silently during calculation
- Error handling should not block the user from continuing after entering ET0 values
- ETc calculations will be saved to the database immediately, making them available even if the user doesn't view the table

### To-dos

- [ ] Create _calculate_and_save_etc_for_dates() helper method in IrrigationApp class to handle ETc calculation and database saving
- [ ] Modify input_weather_data() to call the helper method after all three ET0 values are saved
- [ ] Refactor view_etc_table() to use the new helper method, keeping display logic separate
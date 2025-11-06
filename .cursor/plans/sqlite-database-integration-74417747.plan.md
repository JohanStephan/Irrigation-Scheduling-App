<!-- 74417747-2c2f-4e3f-9e6b-93b5b68058a8 2346839c-e22a-422d-874c-0aecc14f4f84 -->
# Database Backend Implementation Plan

## Overview

Implement SQLite database persistence to store field information, weather data (ET0 values), and calculated ETc values. The database will replace the current in-memory storage approach.

## Database Schema

### Tables

1. **fields** table

- `field_name` (TEXT PRIMARY KEY)
- `crop_factor` (REAL NOT NULL)
- `fertilizer_week` (INTEGER NOT NULL)

2. **weather_data** table

- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `date` (TEXT NOT NULL, ISO 8601 format)
- `et0` (REAL NOT NULL)
- UNIQUE constraint on `date` to prevent duplicates

3. **etc_calculations** table

- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `field_name` (TEXT NOT NULL, references fields.field_name)
- `date` (TEXT NOT NULL)
- `etc_value` (REAL NOT NULL)
- `calculated_at` (TEXT NOT NULL, ISO 8601 timestamp)
- Index on `field_name` and `date` for efficient queries

## Implementation Steps

### 1. Create Database Module (`database.py`)

- `init_database(db_path)` - Create database file and tables if they don't exist
- `get_db_connection(db_path)` - Get database connection
- Field operations: `create_field()`, `get_all_fields()`, `update_field()`, `delete_field()`, `field_exists()`
- Weather data operations: `save_weather_data()`, `get_weather_data_by_date()`, `get_weather_data_by_dates()`
- ETc operations: `save_etc_calculation()`, `save_etc_calculations_batch()`, `get_etc_history()`

### 2. Update `app.py`

- Add database initialization in `__init__()` method
- Replace in-memory `self.fields` list with database queries
- Replace in-memory `self.weather_data` list with database queries
- Modify `add_field()`, `edit_field()`, `delete_field()` to persist changes to database
- Modify `input_weather_data()` to save ET0 values to database
- Modify `view_etc_table()` to save calculated ETc values to database
- Remove `_initialize_default_fields()` method (no default fields)

### 3. Update `models.py` (if needed)

- Keep existing dataclasses unchanged
- May add helper methods to convert between dataclasses and database rows

### 4. Configuration

- Database file: `irrigation.db` in project root directory
- Handle database file creation on first run
- Add `.gitignore` entry for database file if needed

## Files to Modify

- `app.py` - Integrate database operations
- Create `database.py` - New database module

## Files to Review (No Changes Expected)

- `models.py` - Keep as-is
- `calculator.py` - Keep as-is
- `formatter.py` - Keep as-is

### To-dos

- [ ] Create database.py module with database initialization, connection management, and CRUD operations for fields, weather_data, and etc_calculations tables
- [ ] Update IrrigationApp.__init__() to initialize database and remove default fields initialization
- [ ] Replace in-memory field operations in app.py with database calls (add_field, edit_field, delete_field, display_fields)
- [ ] Replace in-memory weather data operations in app.py with database calls (input_weather_data, view_etc_table)
- [ ] Add functionality to save ETc calculations to database when viewing ETc table
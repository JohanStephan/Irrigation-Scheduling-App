"""
Database module for Irrigation Scheduling Application.

Provides SQLite database operations for fields, weather data, and ETc calculations.
"""

import sqlite3
from datetime import datetime
from typing import List, Optional, Dict
from models import Field, WeatherData


def get_db_connection(db_path: str) -> sqlite3.Connection:
    """
    Get a database connection.
    
    Args:
        db_path: Path to the SQLite database file
        
    Returns:
        SQLite connection object
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_database(db_path: str):
    """
    Initialize the database by creating all tables if they don't exist.
    
    Args:
        db_path: Path to the SQLite database file
    """
    conn = get_db_connection(db_path)
    try:
        cursor = conn.cursor()
        
        # Create fields table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS fields (
                field_name TEXT PRIMARY KEY,
                crop_factor REAL NOT NULL,
                fertilizer_week INTEGER NOT NULL
            )
        """)
        
        # Create weather_data table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS weather_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL UNIQUE,
                et0 REAL NOT NULL
            )
        """)
        
        # Create index on weather_data.date for efficient queries
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_weather_data_date 
            ON weather_data(date)
        """)
        
        # Create etc_calculations table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS etc_calculations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                field_name TEXT NOT NULL,
                date TEXT NOT NULL,
                etc_value REAL NOT NULL,
                calculated_at TEXT NOT NULL
            )
        """)
        
        # Create index on etc_calculations field_name and date
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_etc_calculations_field_date 
            ON etc_calculations(field_name, date)
        """)
        
        # Create index on etc_calculations calculated_at for historical queries
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_etc_calculations_calculated_at 
            ON etc_calculations(calculated_at)
        """)
        
        conn.commit()
    finally:
        conn.close()


def initialize_default_fields(db_path: str):
    """
    Initialize default fields (DF1B, SS2B, MF8B) if database is empty.
    
    Args:
        db_path: Path to the SQLite database file
    """
    conn = get_db_connection(db_path)
    try:
        cursor = conn.cursor()
        
        # Check if any fields exist
        cursor.execute("SELECT COUNT(*) FROM fields")
        count = cursor.fetchone()[0]
        
        # Only insert defaults if database is empty
        if count == 0:
            default_fields = [
                ("DF1B", 0.0, 1),
                ("SS2B", 0.0, 1),
                ("MF8B", 0.0, 1),
            ]
            cursor.executemany(
                "INSERT INTO fields (field_name, crop_factor, fertilizer_week) VALUES (?, ?, ?)",
                default_fields
            )
            conn.commit()
    finally:
        conn.close()


def create_field(db_path: str, field_name: str, crop_factor: float, fertilizer_week: int):
    """
    Create a new field in the database.
    
    Args:
        db_path: Path to the SQLite database file
        field_name: Name of the field
        crop_factor: Crop coefficient (Kc)
        fertilizer_week: Fertilizer application week
        
    Raises:
        sqlite3.IntegrityError: If field_name already exists
    """
    conn = get_db_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO fields (field_name, crop_factor, fertilizer_week) VALUES (?, ?, ?)",
            (field_name, crop_factor, fertilizer_week)
        )
        conn.commit()
    finally:
        conn.close()


def get_all_fields(db_path: str) -> List[Field]:
    """
    Retrieve all fields from the database.
    
    Args:
        db_path: Path to the SQLite database file
        
    Returns:
        List of Field objects
    """
    conn = get_db_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT field_name, crop_factor, fertilizer_week FROM fields")
        rows = cursor.fetchall()
        return [Field(field_name=row[0], crop_factor=row[1], fertilizer_week=row[2]) for row in rows]
    finally:
        conn.close()


def get_field(db_path: str, field_name: str) -> Optional[Field]:
    """
    Get a single field by name.
    
    Args:
        db_path: Path to the SQLite database file
        field_name: Name of the field to retrieve
        
    Returns:
        Field object if found, None otherwise
    """
    conn = get_db_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT field_name, crop_factor, fertilizer_week FROM fields WHERE field_name = ?",
            (field_name,)
        )
        row = cursor.fetchone()
        if row:
            return Field(field_name=row[0], crop_factor=row[1], fertilizer_week=row[2])
        return None
    finally:
        conn.close()


def update_field(db_path: str, field_name: str, crop_factor: float, fertilizer_week: int):
    """
    Update an existing field in the database.
    
    Args:
        db_path: Path to the SQLite database file
        field_name: Name of the field to update
        crop_factor: New crop coefficient (Kc)
        fertilizer_week: New fertilizer application week
        
    Raises:
        ValueError: If field does not exist
    """
    conn = get_db_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE fields SET crop_factor = ?, fertilizer_week = ? WHERE field_name = ?",
            (crop_factor, fertilizer_week, field_name)
        )
        if cursor.rowcount == 0:
            raise ValueError(f"Field '{field_name}' not found")
        conn.commit()
    finally:
        conn.close()


def delete_field(db_path: str, field_name: str):
    """
    Delete a field from the database.
    
    Args:
        db_path: Path to the SQLite database file
        field_name: Name of the field to delete
        
    Raises:
        ValueError: If field does not exist
    """
    conn = get_db_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM fields WHERE field_name = ?", (field_name,))
        if cursor.rowcount == 0:
            raise ValueError(f"Field '{field_name}' not found")
        conn.commit()
    finally:
        conn.close()


def field_exists(db_path: str, field_name: str) -> bool:
    """
    Check if a field exists in the database.
    
    Args:
        db_path: Path to the SQLite database file
        field_name: Name of the field to check
        
    Returns:
        True if field exists, False otherwise
    """
    conn = get_db_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM fields WHERE field_name = ?", (field_name,))
        return cursor.fetchone() is not None
    finally:
        conn.close()


def save_weather_data(db_path: str, date: str, et0: float):
    """
    Save weather data for a date. Uses UPSERT to update if date already exists.
    
    Args:
        db_path: Path to the SQLite database file
        date: Date in ISO 8601 format (YYYY-MM-DD)
        et0: Reference evapotranspiration value (mm/day)
    """
    conn = get_db_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT OR REPLACE INTO weather_data (date, et0) VALUES (?, ?)",
            (date, et0)
        )
        conn.commit()
    finally:
        conn.close()


def get_weather_data_by_date(db_path: str, date: str) -> Optional[WeatherData]:
    """
    Get weather data for a specific date.
    
    Args:
        db_path: Path to the SQLite database file
        date: Date in ISO 8601 format (YYYY-MM-DD)
        
    Returns:
        WeatherData object if found, None otherwise
    """
    conn = get_db_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT date, et0 FROM weather_data WHERE date = ?", (date,))
        row = cursor.fetchone()
        if row:
            return WeatherData(date=row[0], et0=row[1])
        return None
    finally:
        conn.close()


def get_weather_data_by_dates(db_path: str, dates: List[str]) -> List[WeatherData]:
    """
    Get weather data for multiple dates.
    
    Args:
        db_path: Path to the SQLite database file
        dates: List of dates in ISO 8601 format (YYYY-MM-DD)
        
    Returns:
        List of WeatherData objects, sorted by date
    """
    if not dates:
        return []
    
    conn = get_db_connection(db_path)
    try:
        cursor = conn.cursor()
        placeholders = ','.join('?' * len(dates))
        cursor.execute(
            f"SELECT date, et0 FROM weather_data WHERE date IN ({placeholders}) ORDER BY date",
            dates
        )
        rows = cursor.fetchall()
        return [WeatherData(date=row[0], et0=row[1]) for row in rows]
    finally:
        conn.close()


def get_all_weather_data(db_path: str) -> List[WeatherData]:
    """
    Get all historical weather data from the database.
    
    Args:
        db_path: Path to the SQLite database file
        
    Returns:
        List of WeatherData objects, sorted by date
    """
    conn = get_db_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT date, et0 FROM weather_data ORDER BY date")
        rows = cursor.fetchall()
        return [WeatherData(date=row[0], et0=row[1]) for row in rows]
    finally:
        conn.close()


def save_etc_calculation(db_path: str, field_name: str, date: str, etc_value: float):
    """
    Save a single ETc calculation to the database.
    
    Args:
        db_path: Path to the SQLite database file
        field_name: Name of the field
        date: Date in ISO 8601 format (YYYY-MM-DD)
        etc_value: Calculated ETc value
    """
    calculated_at = datetime.now().isoformat()
    conn = get_db_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO etc_calculations (field_name, date, etc_value, calculated_at) VALUES (?, ?, ?, ?)",
            (field_name, date, etc_value, calculated_at)
        )
        conn.commit()
    finally:
        conn.close()


def save_etc_calculations_batch(db_path: str, etc_results: Dict[str, Dict[str, float]], weather_data_list: List[WeatherData]):
    """
    Batch save ETc calculations for multiple fields and dates.
    
    For each (field_name, date) combination, any existing ETc entries are deleted
    before inserting the new calculation, ensuring each field has only one ETc value per date.
    
    Args:
        db_path: Path to the SQLite database file
        etc_results: Dictionary with structure: {field_name: {date: etc_value}}
        weather_data_list: List of WeatherData objects (used to get dates)
    """
    calculated_at = datetime.now().isoformat()
    conn = get_db_connection(db_path)
    try:
        cursor = conn.cursor()
        for field_name, date_results in etc_results.items():
            for weather_data in weather_data_list:
                date = weather_data.date
                if date in date_results:
                    etc_value = date_results[date]
                    # Delete existing ETc entries for this field_name and date
                    cursor.execute(
                        "DELETE FROM etc_calculations WHERE field_name = ? AND date = ?",
                        (field_name, date)
                    )
                    # Insert the new ETc calculation
                    cursor.execute(
                        "INSERT INTO etc_calculations (field_name, date, etc_value, calculated_at) VALUES (?, ?, ?, ?)",
                        (field_name, date, etc_value, calculated_at)
                    )
        conn.commit()
    finally:
        conn.close()


def get_etc_history(db_path: str, field_name: Optional[str] = None, date: Optional[str] = None) -> List[Dict]:
    """
    Query ETc calculation history.
    
    Args:
        db_path: Path to the SQLite database file
        field_name: Optional field name to filter by
        date: Optional date to filter by
        
    Returns:
        List of dictionaries with ETc calculation records
    """
    conn = get_db_connection(db_path)
    try:
        cursor = conn.cursor()
        query = "SELECT field_name, date, etc_value, calculated_at FROM etc_calculations WHERE 1=1"
        params = []
        
        if field_name:
            query += " AND field_name = ?"
            params.append(field_name)
        
        if date:
            query += " AND date = ?"
            params.append(date)
        
        query += " ORDER BY calculated_at DESC"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [
            {
                "field_name": row[0],
                "date": row[1],
                "etc_value": row[2],
                "calculated_at": row[3]
            }
            for row in rows
        ]
    finally:
        conn.close()


"""
ETc calculation functions for irrigation scheduling.
"""

from typing import List, Optional
from models import Field, WeatherData


def calculate_etc(field: Field, weather_data: WeatherData) -> float:
    """
    Calculate ETc (Evapotranspiration Crop) for a field.
    
    Formula: ETc = ET0 × Kc (crop_factor)
    
    Args:
        field: Field object containing crop_factor
        weather_data: WeatherData object containing ET0
        
    Returns:
        Calculated ETc value (float)
    """
    return weather_data.et0 * field.crop_factor


def calculate_etc_for_all_fields(
    fields: List[Field],
    weather_data_list: List[WeatherData]
) -> dict:
    """
    Calculate ETc for all fields across all dates.
    
    Args:
        fields: List of Field objects
        weather_data_list: List of WeatherData objects (one per date)
        
    Returns:
        Dictionary with structure: {field_name: {date: etc_value}}
    """
    results = {}
    
    for field in fields:
        results[field.field_name] = {}
        for weather_data in weather_data_list:
            etc_value = calculate_etc(field, weather_data)
            results[field.field_name][weather_data.date] = etc_value
    
    return results


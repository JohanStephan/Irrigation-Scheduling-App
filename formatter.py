"""
Table formatting utilities for displaying ETc results.
"""

from typing import List, Dict
from models import Field, WeatherData


def format_etc_table(
    fields: List[Field],
    weather_data_list: List[WeatherData],
    etc_results: Dict[str, Dict[str, float]]
) -> str:
    """
    Format ETc results as a markdown table.
    
    Args:
        fields: List of Field objects (will be sorted alphabetically)
        weather_data_list: List of WeatherData objects (one per date)
        etc_results: Dictionary with structure: {field_name: {date: etc_value}}
        
    Returns:
        Markdown-formatted table string
    """
    if not fields:
        return "No fields available to display."
    
    if not weather_data_list:
        return "No weather data available to display."
    
    # Sort fields alphabetically by field_name
    sorted_fields = sorted(fields, key=lambda f: f.field_name)
    
    # Extract dates from weather_data_list (should already be sorted)
    dates = [wd.date for wd in weather_data_list]
    
    # Build markdown table
    lines = []
    
    # Header row
    header = "| Field | " + " | ".join(dates) + " |"
    lines.append(header)
    
    # Separator row
    separator = "|" + "|".join([" --- " for _ in range(len(dates) + 1)]) + "|"
    lines.append(separator)
    
    # Data rows
    for field in sorted_fields:
        row_values = [field.field_name]
        for date in dates:
            etc_value = etc_results.get(field.field_name, {}).get(date, None)
            if etc_value is not None:
                row_values.append(f"{etc_value:.2f}")
            else:
                row_values.append("N/A")
        row = "| " + " | ".join(row_values) + " |"
        lines.append(row)
    
    return "\n".join(lines)


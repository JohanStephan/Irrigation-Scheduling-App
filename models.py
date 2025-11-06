"""
Data models for the Irrigation Scheduling Application.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class Field:
    """
    Represents an agricultural field with crop information.
    
    Attributes:
        field_name: Name of the field (e.g., 'DF1B')
        crop_factor: Crop coefficient (Kc) used for ETc calculation
        fertilizer_week: Week number for fertilizer application
    """
    field_name: str
    crop_factor: float
    fertilizer_week: int
    
    def __post_init__(self):
        """Validate field data after initialization."""
        if not isinstance(self.field_name, str) or not self.field_name.strip():
            raise ValueError("field_name must be a non-empty string")
        if not isinstance(self.crop_factor, (int, float)) or self.crop_factor < 0:
            raise ValueError("crop_factor must be a non-negative number")
        if not isinstance(self.fertilizer_week, int) or self.fertilizer_week < 1:
            raise ValueError("fertilizer_week must be a positive integer")


@dataclass
class WeatherData:
    """
    Represents weather data for a specific date.
    
    Attributes:
        date: Date in ISO 8601 format (YYYY-MM-DD)
        et0: Reference evapotranspiration value (mm/day)
    """
    date: str
    et0: float
    
    def __post_init__(self):
        """Validate weather data after initialization."""
        if not isinstance(self.date, str):
            raise ValueError("date must be a string")
        # Basic ISO 8601 date format validation (YYYY-MM-DD)
        if len(self.date) != 10 or self.date[4] != '-' or self.date[7] != '-':
            raise ValueError("date must be in ISO 8601 format (YYYY-MM-DD)")
        if not isinstance(self.et0, (int, float)) or self.et0 < 0:
            raise ValueError("et0 must be a non-negative number")


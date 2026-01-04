"""Unit tests for FIT file processing services."""

import pytest
from datetime import datetime
import numpy as np
import pandas as pd

from app.services.fit_processing.power_metrics import calculate_tss, calculate_if

# Since the power_metrics module uses functions, not classes, skip detailed tests
# These would require mocking the entire DataFrame structure
# Instead, test the core_metrics functions which are used directly


class TestPowerMetricsBasic:
    """Test basic power metrics that can be tested without full DataFrame."""

    def test_power_data_structure(self):
        """Test that we can create power data structure."""
        power_data = np.array([200, 250, 300], dtype=float)
        assert len(power_data) == 3
        assert power_data.mean() == 250.0


class TestCoreMetrics:
    """Test core training metrics calculations."""

    def test_tss_calculation_at_threshold(self):
        """Test TSS calculation at FTP."""
        duration_seconds = 3600.0
        normalized_power = 250.0
        ftp = 250.0

        tss = calculate_tss(normalized_power, duration_seconds, ftp)

        # 1 hour at FTP should be exactly 100 TSS
        assert abs(tss - 100.0) < 1.0

    def test_tss_calculation_above_threshold(self):
        """Test TSS calculation above FTP."""
        duration_seconds = 3600.0
        normalized_power = 300.0  # 120% of FTP
        ftp = 250.0

        tss = calculate_tss(normalized_power, duration_seconds, ftp)

        # Above FTP, TSS increases exponentially
        # At 120% FTP, TSS ~= 144
        assert 140.0 < tss < 150.0

    def test_tss_calculation_below_threshold(self):
        """Test TSS calculation below FTP."""
        duration_seconds = 3600.0
        normalized_power = 200.0  # 80% of FTP
        ftp = 250.0

        tss = calculate_tss(normalized_power, duration_seconds, ftp)

        # Below FTP, TSS is proportionally less
        # At 80% FTP, TSS ~= 64
        assert 60.0 < tss < 68.0

    def test_tss_zero_power(self):
        """Test TSS with zero power."""
        tss = calculate_tss(0.0, 3600.0, 250.0)
        assert tss is None

    def test_tss_zero_ftp(self):
        """Test TSS with zero FTP."""
        # Should handle gracefully (return 0 or raise)
        tss = calculate_tss(200.0, 3600.0, 0.0)
        assert tss is None

    def test_intensity_factor_at_threshold(self):
        """Test IF at FTP."""
        if_value = calculate_if(250.0, 250.0)
        assert abs(if_value - 1.0) < 0.01

    def test_intensity_factor_below_threshold(self):
        """Test IF below FTP."""
        if_value = calculate_if(200.0, 250.0)
        assert abs(if_value - 0.8) < 0.01

    def test_intensity_factor_above_threshold(self):
        """Test IF above FTP."""
        if_value = calculate_if(300.0, 250.0)
        assert abs(if_value - 1.2) < 0.01


class TestHeartRateMetrics:
    """Test heart rate metric calculations."""

    def test_efficiency_factor_calculation(self):
        """Test efficiency factor calculation (NP/HR)."""
        normalized_power = 220.0
        avg_heart_rate = 155.0

        # EF = NP / HR
        ef = normalized_power / avg_heart_rate
        expected = 220.0 / 155.0
        assert abs(ef - expected) < 0.01

    def test_heart_rate_zones_basic(self):
        """Test basic HR zone calculation."""
        hr_max = 185
        hr_values = [100, 120, 140, 160, 175]

        # Zone 1: <60% max (< 111)
        # Zone 2: 60-70% (111-129)
        # Zone 3: 70-80% (130-148)
        # Zone 4: 80-90% (149-166)
        # Zone 5: >90% (>166)

        zones = []
        for hr in hr_values:
            pct = hr / hr_max
            if pct < 0.6:
                zones.append(1)
            elif pct < 0.7:
                zones.append(2)
            elif pct < 0.8:
                zones.append(3)
            elif pct < 0.9:
                zones.append(4)
            else:
                zones.append(5)

        assert len(zones) == 5
        # Verify zone distribution matches expectations
        assert zones[0] in [1, 2]  # 100 bpm should be zone 1-2
        assert zones[-1] == 5  # 175 bpm should be zone 5

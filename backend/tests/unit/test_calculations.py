"""
Unit tests for training calculations.

Tests:
- TSS (Training Stress Score) calculation
- Intensity Factor calculation
- Normalized Power calculation
- Training Load (CTL/ATL/TSB) calculation
- Power curve calculations
- Critical Power model
"""

import pytest
import numpy as np
from datetime import datetime, timedelta


@pytest.mark.calculations
@pytest.mark.unit
class TestTSSCalculations:
    """Test Training Stress Score calculations."""

    def test_tss_basic_calculation(self):
        """Test basic TSS calculation formula.

        TSS = (duration_seconds * normalized_power * intensity_factor) / (ftp * 3600) * 100
        """
        duration_seconds = 3600  # 1 hour
        normalized_power = 200
        ftp = 250
        intensity_factor = normalized_power / ftp  # 0.8

        # Expected TSS for 1 hour at IF=0.8
        # TSS = (3600 * 200 * 0.8) / (250 * 3600) * 100
        # TSS = 576000 / 900000 * 100 = 64
        expected_tss = (duration_seconds * normalized_power * intensity_factor) / (ftp * 3600) * 100

        assert round(expected_tss, 1) == 64.0

    def test_tss_at_ftp(self):
        """Test that 1 hour at FTP = 100 TSS."""
        duration_seconds = 3600  # 1 hour
        normalized_power = 250
        ftp = 250
        intensity_factor = normalized_power / ftp  # 1.0

        tss = (duration_seconds * normalized_power * intensity_factor) / (ftp * 3600) * 100

        assert round(tss, 0) == 100.0

    def test_tss_high_intensity(self):
        """Test TSS for high-intensity workout."""
        duration_seconds = 1800  # 30 minutes
        normalized_power = 300  # 120% of FTP
        ftp = 250
        intensity_factor = normalized_power / ftp  # 1.2

        tss = (duration_seconds * normalized_power * intensity_factor) / (ftp * 3600) * 100

        # High intensity = high TSS per hour
        assert tss > 70  # More than 70 TSS in 30 minutes

    def test_tss_low_intensity(self):
        """Test TSS for low-intensity workout."""
        duration_seconds = 3600  # 1 hour
        normalized_power = 150  # 60% of FTP
        ftp = 250
        intensity_factor = normalized_power / ftp  # 0.6

        tss = (duration_seconds * normalized_power * intensity_factor) / (ftp * 3600) * 100

        # Low intensity = lower TSS
        assert 30 < tss < 50  # Around 36 TSS for 1 hour at 60%


@pytest.mark.calculations
@pytest.mark.unit
class TestIntensityFactor:
    """Test Intensity Factor calculations."""

    def test_intensity_factor_basic(self):
        """Test basic IF calculation: IF = NP / FTP."""
        normalized_power = 200
        ftp = 250
        intensity_factor = normalized_power / ftp

        assert intensity_factor == 0.8

    def test_intensity_factor_at_threshold(self):
        """Test IF = 1.0 when riding at FTP."""
        normalized_power = 250
        ftp = 250
        intensity_factor = normalized_power / ftp

        assert intensity_factor == 1.0

    def test_intensity_factor_above_threshold(self):
        """Test IF > 1.0 when riding above FTP."""
        normalized_power = 300
        ftp = 250
        intensity_factor = normalized_power / ftp

        assert intensity_factor == 1.2
        assert intensity_factor > 1.0

    def test_intensity_factor_recovery(self):
        """Test IF < 0.7 for recovery rides."""
        normalized_power = 150
        ftp = 250
        intensity_factor = normalized_power / ftp

        assert intensity_factor == 0.6
        assert intensity_factor < 0.7


@pytest.mark.calculations
@pytest.mark.unit
class TestTrainingLoad:
    """Test Training Load (CTL/ATL/TSB) calculations."""

    def test_ctl_calculation(self):
        """Test Chronic Training Load calculation.

        CTL (Fitness) = exponentially weighted moving average with 42-day time constant
        """
        # Simplified test: CTL today = yesterday's CTL + (today's TSS - yesterday's CTL) / 42
        ctl_yesterday = 50
        tss_today = 100

        ctl_today = ctl_yesterday + (tss_today - ctl_yesterday) / 42

        expected_ctl = 50 + (100 - 50) / 42
        assert round(ctl_today, 2) == round(expected_ctl, 2)
        assert ctl_today > ctl_yesterday  # CTL should increase with training

    def test_atl_calculation(self):
        """Test Acute Training Load calculation.

        ATL (Fatigue) = exponentially weighted moving average with 7-day time constant
        """
        # Simplified test: ATL today = yesterday's ATL + (today's TSS - yesterday's ATL) / 7
        atl_yesterday = 60
        tss_today = 100

        atl_today = atl_yesterday + (tss_today - atl_yesterday) / 7

        expected_atl = 60 + (100 - 60) / 7
        assert round(atl_today, 2) == round(expected_atl, 2)
        assert atl_today > atl_yesterday  # ATL should increase with hard workout

    def test_tsb_calculation(self):
        """Test Training Stress Balance calculation.

        TSB (Form) = CTL - ATL
        """
        ctl = 50  # Fitness
        atl = 60  # Fatigue

        tsb = ctl - atl

        assert tsb == -10
        # Negative TSB means fatigue > fitness (fresh training)

    def test_tsb_positive_form(self):
        """Test TSB when well-rested (positive form)."""
        ctl = 60
        atl = 50

        tsb = ctl - atl

        assert tsb == 10
        # Positive TSB = good form (rested)

    def test_tsb_negative_form(self):
        """Test TSB when fatigued (negative form)."""
        ctl = 50
        atl = 70

        tsb = ctl - atl

        assert tsb == -20
        # Negative TSB = fatigued

    def test_rest_day_atl_decay(self):
        """Test that ATL decays faster than CTL on rest days."""
        ctl = 60
        atl = 70
        tss_today = 0  # Rest day

        # On rest day, both decay toward zero
        ctl_new = ctl + (tss_today - ctl) / 42  # CTL time constant = 42
        atl_new = atl + (tss_today - atl) / 7   # ATL time constant = 7

        # ATL should decay more (bigger change)
        ctl_decay = ctl - ctl_new
        atl_decay = atl - atl_new

        assert atl_decay > ctl_decay  # Fatigue drops faster than fitness


@pytest.mark.calculations
@pytest.mark.unit
class TestPowerCurve:
    """Test power curve calculations."""

    def test_max_power_from_samples(self):
        """Test finding max power for different durations."""
        # Sample power data (watts) at 1-second intervals
        power_samples = [100, 150, 200, 250, 300, 280, 260, 240, 220, 200]

        # Max 1-second power
        max_1s = max(power_samples)
        assert max_1s == 300

        # Max 3-second power (moving average)
        max_3s = max([
            sum(power_samples[i:i+3])/3
            for i in range(len(power_samples)-2)
        ])
        # Should be around (250+300+280)/3 = 276.67
        assert 270 < max_3s < 285  # Slightly wider range

    def test_power_curve_duration_order(self):
        """Test that power curve decreases with duration."""
        # Simulated power curve values
        power_5s = 500
        power_1min = 400
        power_5min = 300
        power_20min = 250
        power_60min = 200

        # Longer durations should have lower power
        assert power_5s > power_1min > power_5min > power_20min > power_60min

    def test_weighted_power_curve(self):
        """Test weight-normalized power curve."""
        absolute_power_60min = 200  # watts
        weight = 70  # kg

        watts_per_kg = absolute_power_60min / weight

        assert round(watts_per_kg, 2) == 2.86


@pytest.mark.calculations
@pytest.mark.unit
class TestCriticalPower:
    """Test Critical Power model calculations."""

    def test_critical_power_two_parameter_model(self):
        """Test 2-parameter CP model: time = W' / (P - CP).

        Where:
        - CP = Critical Power (watts)
        - W' = Work capacity above CP (joules)
        - P = Power output
        - time = time to exhaustion
        """
        # Known values
        cp = 250  # watts
        w_prime = 20000  # joules (20 kJ)

        # At 300 watts, time to exhaustion = W' / (P - CP)
        power = 300
        time_to_exhaustion = w_prime / (power - cp)

        expected_time = 20000 / (300 - 250)  # 20000 / 50 = 400 seconds
        assert time_to_exhaustion == 400

    def test_cp_from_two_efforts(self):
        """Test CP calculation from two maximal efforts.

        From two time trials:
        - Time1, Power1
        - Time2, Power2

        CP can be calculated from the linear relationship
        """
        # 3-minute effort: 350W for 180 seconds
        time1 = 180
        power1 = 350
        work1 = power1 * time1  # 63000 joules

        # 12-minute effort: 280W for 720 seconds
        time2 = 720
        power2 = 280
        work2 = power2 * time2  # 201600 joules

        # CP = (Work2 - Work1) / (Time2 - Time1)
        cp = (work2 - work1) / (time2 - time1)

        expected_cp = (201600 - 63000) / (720 - 180)
        assert round(cp, 1) == round(expected_cp, 1)
        assert 250 < cp < 260  # Should be reasonable CP value


@pytest.mark.calculations
@pytest.mark.unit
class TestEfficiencyFactor:
    """Test Efficiency Factor calculations."""

    def test_efficiency_factor_basic(self):
        """Test EF = Normalized Power / Average Heart Rate."""
        normalized_power = 200
        avg_heart_rate = 140

        ef = normalized_power / avg_heart_rate

        assert round(ef, 2) == 1.43

    def test_efficiency_factor_improves_with_fitness(self):
        """Test that EF increases as fitness improves."""
        # Early season: same power requires higher HR
        ef_early = 180 / 150  # 1.20

        # Late season: same power at lower HR (more efficient)
        ef_late = 180 / 140  # 1.29

        assert ef_late > ef_early

    def test_efficiency_factor_reasonable_range(self):
        """Test that EF values are in reasonable range."""
        # Typical EF range: 0.8 - 2.0 for most athletes
        normalized_power = 200
        avg_heart_rate = 145

        ef = normalized_power / avg_heart_rate

        assert 0.8 < ef < 2.0

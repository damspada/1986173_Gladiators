import numpy as np
from collections import deque, defaultdict

class SeismicAnalyzer:
    def __init__(self, window_size=200, sampling_rate=20.0):
        """
        Initialize the analyzer with a sliding window.
        - window_size: samples needed for analysis (200 samples = 10s @ 20Hz).
        - sampling_rate: dynamic rate fetched from simulator /health.
        """
        self.sampling_rate = sampling_rate
        self.window_size = window_size
        
        # defaultdict ensures a separate deque for each sensor_id.
        self.windows = defaultdict(lambda: deque(maxlen=window_size))

    def process_measurement(self, sensor_id: str, value: float) -> dict:
        """
        Adds a new sample. Triggers FFT analysis when the window reaches window_size.
        """
        window = self.windows[sensor_id]
        window.append(value)

        # Analyze only when we have enough data points
        if len(window) == self.window_size:
            return self._analyze_signal(sensor_id, list(window))
        
        return None

    def _analyze_signal(self, sensor_id: str, data: list) -> dict:
        """
        Calculates FFT and extracts the peak frequency for classification.
        """
        signal = np.array(data)

        # 1. Real FFT (Optimized for real-valued seismic signals)
        fft_values = np.fft.rfft(signal)
        frequencies = np.fft.rfftfreq(len(signal), d=1.0/self.sampling_rate)

        # 2. Extract magnitudes and remove DC offset (0 Hz component)
        magnitudes = np.abs(fft_values)
        magnitudes[0] = 0 
        
        # 3. Find peak frequency
        peak_index = np.argmax(magnitudes)
        # CRITICAL: Convert numpy.float64 to standard Python float for JSON compatibility
        dominant_freq = float(frequencies[peak_index])

        # 4. Classify based on project requirements
        event_type = self._classify(dominant_freq)

        if event_type:
            # Clear window to prevent redundant alerts for the same physical event
            self.windows[sensor_id].clear()
            
            return {
                "sensor_id": sensor_id,
                "dominant_frequency": round(dominant_freq, 2),
                "event_type": event_type
            }
        
        return None

    def _classify(self, f: float) -> str:
        """
        Classification logic as per 'A Fragile Balance of Power' requirements.
        """
        if 0.5 <= f < 3.0:
            return "EARTHQUAKE"
        elif 3.0 <= f < 8.0:
            return "CONVENTIONAL_EXPLOSION"
        elif f >= 8.0:
            return "NUCLEAR_EVENT"
        return None
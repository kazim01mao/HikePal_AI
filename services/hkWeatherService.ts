export interface HKWeatherData {
  temp: number;
  humidity: number;
  condition: string;
  iconId?: number;
  rainfallMm?: number;
  fetchedAt: string;
}

const mapHkoIconToCondition = (iconId?: number): string => {
  if (!iconId && iconId !== 0) return 'Unknown';
  if (iconId >= 50 && iconId <= 54) return 'Sunny';
  if (iconId >= 60 && iconId <= 65) return 'Cloudy';
  if (iconId >= 70 && iconId <= 77) return 'Showers';
  if (iconId >= 80 && iconId <= 85) return 'Rain';
  if (iconId >= 90 && iconId <= 93) return 'Thunderstorm';
  return 'Partly Cloudy';
};

export const getFallbackHKWeather = (): HKWeatherData => ({
  temp: 26,
  humidity: 72,
  condition: 'Partly Cloudy',
  rainfallMm: 0,
  fetchedAt: new Date().toISOString(),
});

export async function fetchHongKongCurrentWeather(): Promise<HKWeatherData> {
  try {
    const response = await fetch('https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=en');
    if (!response.ok) throw new Error(`HKO weather request failed: ${response.status}`);
    const data = await response.json();

    const iconId = Array.isArray(data?.icon) && data.icon.length > 0 ? Number(data.icon[0]) : undefined;
    const temp = Number(data?.temperature?.data?.[0]?.value);
    const humidity = Number(data?.humidity?.data?.[0]?.value);
    const rainfallMm = Number(data?.rainfall?.data?.[0]?.max ?? 0);

    return {
      temp: Number.isFinite(temp) ? temp : 26,
      humidity: Number.isFinite(humidity) ? humidity : 72,
      condition: mapHkoIconToCondition(iconId),
      iconId,
      rainfallMm: Number.isFinite(rainfallMm) ? rainfallMm : 0,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to fetch Hong Kong weather:', error);
    return getFallbackHKWeather();
  }
}

export const formatWeatherForPrompt = (weather?: Partial<HKWeatherData> | null): string => {
  if (!weather) return 'Weather data unavailable';
  const temp = typeof weather.temp === 'number' ? `${weather.temp}C` : 'N/A';
  const humidity = typeof weather.humidity === 'number' ? `${weather.humidity}%` : 'N/A';
  const rainfall = typeof weather.rainfallMm === 'number' ? `${weather.rainfallMm}mm` : 'N/A';
  return `${weather.condition || 'Unknown'}, temp ${temp}, humidity ${humidity}, rainfall ${rainfall}`;
};

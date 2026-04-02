export interface HKWeatherData {
  temp: number;
  humidity: number;
  condition: string;
  iconId?: number;
  rainfallMm?: number;
  fetchedAt: string;
  sunrise?: string;
  sunset?: string;
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
    // Fetch current weather
    const weatherResponse = await fetch('https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=en');
    if (!weatherResponse.ok) throw new Error(`HKO weather request failed: ${weatherResponse.status}`);
    const weatherData = await weatherResponse.json();

    const iconId = Array.isArray(weatherData?.icon) && weatherData.icon.length > 0 ? Number(weatherData.icon[0]) : undefined;
    const temp = Number(weatherData?.temperature?.data?.[0]?.value);
    const humidity = Number(weatherData?.humidity?.data?.[0]?.value);
    const rainfallMm = Number(weatherData?.rainfall?.data?.[0]?.max ?? 0);

    // Fetch sunrise/sunset data
    let sunrise = '06:30';
    let sunset = '18:30';
    try {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      
      const sunResponse = await fetch(`https://data.weather.gov.hk/weatherAPI/opendata/opendata.php?dataType=RS&rformat=json&year=${year}&month=${month}`);
      if (sunResponse.ok) {
        const sunData = await sunResponse.json();
        if (sunData && sunData.data && Array.isArray(sunData.data)) {
          const todayData = sunData.data.find((d: any) => d.Date === `${year}${month}${day}`);
          if (todayData) {
            sunrise = todayData.Sunrise || sunrise;
            sunset = todayData.Sunset || sunset;
          }
        }
      }
    } catch (sunError) {
      console.warn('Failed to fetch sunrise/sunset data, using defaults:', sunError);
    }

    return {
      temp: Number.isFinite(temp) ? temp : 26,
      humidity: Number.isFinite(humidity) ? humidity : 72,
      condition: mapHkoIconToCondition(iconId),
      iconId,
      rainfallMm: Number.isFinite(rainfallMm) ? rainfallMm : 0,
      sunrise,
      sunset,
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
  const sunrise = weather.sunrise || 'N/A';
  const sunset = weather.sunset || 'N/A';
  return `${weather.condition || 'Unknown'}, temp ${temp}, humidity ${humidity}, rainfall ${rainfall}, sunrise ${sunrise}, sunset ${sunset}`;
};

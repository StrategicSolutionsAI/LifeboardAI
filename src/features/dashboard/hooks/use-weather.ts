import { useState, useEffect } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Sun, CloudSun, Cloud, CloudRain, CloudSnow, CloudLightning } from 'lucide-react'

export interface WeatherData {
  icon: LucideIcon
  temp: number
}

const WEATHER_ICON_MAP: Record<string, LucideIcon> = {
  clear: Sun,
  partly: CloudSun,
  cloud: Cloud,
  drizzle: CloudRain,
  rain: CloudRain,
  snow: CloudSnow,
  thunder: CloudLightning,
}

function getIconForCode(code: number): LucideIcon {
  if (code === 0) return WEATHER_ICON_MAP.clear
  if ([1, 2].includes(code)) return WEATHER_ICON_MAP.partly
  if (code === 3) return WEATHER_ICON_MAP.cloud
  if (code >= 45 && code <= 48) return WEATHER_ICON_MAP.cloud
  if (code >= 51 && code <= 57) return WEATHER_ICON_MAP.drizzle
  if (code >= 61 && code <= 67) return WEATHER_ICON_MAP.rain
  if (code >= 71 && code <= 77) return WEATHER_ICON_MAP.snow
  if (code >= 95) return WEATHER_ICON_MAP.thunder
  return WEATHER_ICON_MAP.cloud
}

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null)

  useEffect(() => {
    if (typeof navigator === 'undefined') return

    const fetchWeather = async (lat: number, lon: number) => {
      try {
        const resp = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`,
        )
        const data = await resp.json()
        if (data?.current_weather) {
          const code = data.current_weather.weathercode as number
          const tempC = data.current_weather.temperature as number
          const temp = tempC * 9 / 5 + 32
          setWeather({ icon: getIconForCode(code), temp })
        }
      } catch (err) {
        console.error('Failed to fetch weather', err)
      }
    }

    const startWeatherFetch = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => fetchWeather(40.7128, -74.006), // fallback: NYC
      )
    }

    if (typeof requestIdleCallback !== 'undefined') {
      const id = requestIdleCallback(startWeatherFetch, { timeout: 3000 })
      return () => cancelIdleCallback(id)
    }
    const timeout = setTimeout(startWeatherFetch, 2000)
    return () => clearTimeout(timeout)
  }, [])

  return weather
}

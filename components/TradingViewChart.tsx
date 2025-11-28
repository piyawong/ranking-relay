'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';

type ChartType = 'Line' | 'Area' | 'Baseline';
type ScaleMode = 'auto' | 'percentage';

interface TradingViewChartProps {
  data: { time: number; value: number }[];
  secondaryData?: { time: number; value: number }[]; // Optional RLB price data
  color?: string;
  secondaryColor?: string;
  height?: number;
  valueFormatter?: (value: number) => string;
  secondaryFormatter?: (value: number) => string;
  onTypeChange?: (type: ChartType) => void;
  showSecondary?: boolean; // Toggle for secondary series
}

export default function TradingViewChart({
  data,
  secondaryData,
  color = '#2962FF',
  secondaryColor = '#FF6B35',
  height = 400,
  valueFormatter = (value: number) => `$${value.toFixed(2)}`,
  secondaryFormatter: _secondaryFormatter = (value: number) => `$${value.toFixed(6)}`,
  onTypeChange,
  showSecondary = true
}: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<any> | null>(null);
  const secondarySeriesRef = useRef<ISeriesApi<any> | null>(null); // For RLB price
  const [chartType, setChartType] = useState<ChartType>('Area');
  const [scaleMode, setScaleMode] = useState<ScaleMode>('percentage');
  const [rlbPriceVisible, setRlbPriceVisible] = useState(true);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Create chart only once on mount
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      width: chartContainerRef.current.clientWidth,
      height: height,
      localization: {
        priceFormatter: valueFormatter,
      },
      leftPriceScale: {
        borderColor: '#334155',
        visible: true,
      },
      rightPriceScale: {
        borderColor: '#334155',
        visible: true,
        // Custom formatter for RLB price (6 decimals)
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: '#334155',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Use ResizeObserver for better resize handling
    resizeObserverRef.current = new ResizeObserver((entries) => {
      if (entries.length === 0 || !chartRef.current) return;
      const { width, height } = entries[0].contentRect;
      chartRef.current.applyOptions({ width, height });
    });

    resizeObserverRef.current.observe(chartContainerRef.current);

    return () => {
      resizeObserverRef.current?.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, []);

  // Helper to validate and clean data
  const cleanData = (rawData: { time: number; value: number }[]) => {
    const cleaned = rawData.filter(d => {
      // Filter out invalid values: null, undefined, NaN, Infinity
      const isValid = (
        d &&
        typeof d.time === 'number' &&
        typeof d.value === 'number' &&
        !isNaN(d.value) &&
        isFinite(d.value) &&
        d.value !== null
      );

      if (!isValid) {
        console.warn('[Chart] Invalid data point filtered out:', d);
      }

      return isValid;
    }).map(d => ({
      time: d.time as any,
      value: d.value
    }));

    // Sort by time to ensure chronological order
    cleaned.sort((a, b) => a.time - b.time);

    // Remove duplicate timestamps (keep last value for each timestamp)
    const deduped: typeof cleaned = [];
    const seenTimes = new Set<number>();

    for (let i = cleaned.length - 1; i >= 0; i--) {
      if (!seenTimes.has(cleaned[i].time)) {
        seenTimes.add(cleaned[i].time);
        deduped.unshift(cleaned[i]);
      }
    }

    if (cleaned.length !== rawData.length) {
      console.log(`[Chart] Data cleaned: ${rawData.length} -> ${cleaned.length} points`);
    }
    if (deduped.length !== cleaned.length) {
      console.log(`[Chart] Duplicates removed: ${cleaned.length} -> ${deduped.length} points`);
    }

    // Calculate data range for debugging
    if (deduped.length > 0) {
      const values = deduped.map(d => d.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min;
      console.log(`[Chart] Value range: $${min.toFixed(2)} - $${max.toFixed(2)} (Δ $${range.toFixed(2)})`);

      if (range === 0) {
        console.warn('[Chart] ⚠️ All values are identical - chart will show a flat line');
      }
    }

    return deduped;
  };

  // Create/recreate series ONLY when chart type changes
  useEffect(() => {
    if (!chartRef.current) return;

    // Remove old series if exists
    if (seriesRef.current) {
      chartRef.current.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }

    // Create new series based on type
    let newSeries: ISeriesApi<any>;

    if (chartType === 'Line') {
      newSeries = chartRef.current.addLineSeries({
        color: color,
        lineWidth: 2,
        priceScaleId: 'left', // Use left axis for main USD value
      });
    } else if (chartType === 'Area') {
      newSeries = chartRef.current.addAreaSeries({
        lineColor: color,
        topColor: color + '80',
        bottomColor: color + '00',
        lineWidth: 2,
        priceScaleId: 'left', // Use left axis for main USD value
      });
    } else {
      // Baseline - calculate average from valid data
      const validData = data.filter(d => typeof d.value === 'number' && !isNaN(d.value) && isFinite(d.value));
      const avgValue = validData.length > 0
        ? validData.reduce((sum, d) => sum + d.value, 0) / validData.length
        : 0;

      newSeries = chartRef.current.addBaselineSeries({
        baseValue: { type: 'price', price: avgValue },
        topLineColor: color,
        bottomLineColor: '#ef5350',
        topFillColor1: color + '40',
        topFillColor2: color + '00',
        bottomFillColor1: '#ef535040',
        bottomFillColor2: '#ef535000',
        lineWidth: 2,
        priceScaleId: 'left', // Use left axis for main USD value
      });
    }

    seriesRef.current = newSeries;

    // Set initial data with validation
    const cleanedData = cleanData(data);
    if (cleanedData.length > 0) {
      newSeries.setData(cleanedData);
      chartRef.current.timeScale().fitContent();
    }
  }, [chartType]);

  // Update series options when color changes (don't recreate)
  useEffect(() => {
    if (!seriesRef.current) return;

    if (chartType === 'Line') {
      seriesRef.current.applyOptions({ color });
    } else if (chartType === 'Area') {
      seriesRef.current.applyOptions({
        lineColor: color,
        topColor: color + '80',
        bottomColor: color + '00',
      });
    } else {
      // Baseline
      seriesRef.current.applyOptions({
        topLineColor: color,
        topFillColor1: color + '40',
        topFillColor2: color + '00',
      });
    }
  }, [color, chartType]);

  // Update data using setData (best practice for complete data replacement)
  useEffect(() => {
    if (!seriesRef.current || data.length === 0) return;

    const cleanedData = cleanData(data);
    if (cleanedData.length > 0) {
      seriesRef.current.setData(cleanedData);

      // Apply scale mode
      if (scaleMode === 'percentage') {
        // Calculate percentage-based scale
        const values = cleanedData.map(d => d.value);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const avg = (min + max) / 2;
        const range = max - min;

        // If range is very small, zoom in to ±5% of average
        if (range < avg * 0.1) {
          // const padding = avg * 0.05;  // Reserved for future use
          chartRef.current?.priceScale('left').applyOptions({
            scaleMargins: {
              top: 0.1,
              bottom: 0.1,
            },
            autoScale: false,
          });

          // Set visible range to show variation better
          seriesRef.current.priceScale().applyOptions({
            autoScale: false,
          });
        } else {
          chartRef.current?.priceScale('left').applyOptions({
            autoScale: true,
            scaleMargins: {
              top: 0.1,
              bottom: 0.1,
            },
          });
        }
      } else {
        // Auto scale mode
        chartRef.current?.priceScale('left').applyOptions({
          autoScale: true,
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
        });
      }

      chartRef.current?.timeScale().fitContent();
    }
  }, [data, scaleMode]);

  // Update height
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({ height });
  }, [height]);

  // Create/update secondary series (RLB Price)
  useEffect(() => {
    if (!chartRef.current || !secondaryData || !showSecondary) {
      // Remove secondary series if it exists but shouldn't
      if (secondarySeriesRef.current && chartRef.current) {
        chartRef.current.removeSeries(secondarySeriesRef.current);
        secondarySeriesRef.current = null;
      }
      return;
    }

    // Create secondary series if it doesn't exist
    if (!secondarySeriesRef.current) {
      const secondarySeries = chartRef.current.addLineSeries({
        color: secondaryColor,
        lineWidth: 2,
        priceScaleId: 'right',
        title: 'RLB Price',
      });
      secondarySeriesRef.current = secondarySeries;

      // Configure right price scale for 6 decimal precision
      chartRef.current.priceScale('right').applyOptions({
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
        borderColor: '#FF6B35',
        // Force precision mode to ensure 6 decimals are shown
        mode: 0, // Normal price scale mode
      });

      // Apply custom formatter to secondary series for 6 decimals
      secondarySeries.applyOptions({
        priceFormat: {
          type: 'price',
          precision: 6,
          minMove: 0.000001,
        },
      });
    }

    // Update secondary series data
    const cleanedSecondaryData = cleanData(secondaryData);
    if (cleanedSecondaryData.length > 0 && rlbPriceVisible) {
      secondarySeriesRef.current.setData(cleanedSecondaryData);
      secondarySeriesRef.current.applyOptions({ visible: true });
    } else {
      secondarySeriesRef.current.applyOptions({ visible: false });
    }
  }, [secondaryData, showSecondary, secondaryColor, rlbPriceVisible]);

  const handleTypeChange = (type: ChartType) => {
    setChartType(type);
    onTypeChange?.(type);
  };

  // Calculate data statistics for display
  const dataStats = (() => {
    const cleaned = cleanData(data);
    if (cleaned.length === 0) return null;

    const values = cleaned.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;

    return { min, max, range, avg, count: cleaned.length };
  })();

  return (
    <div className="w-full space-y-2">
      {/* Chart Type Selector */}
      <div className="flex gap-2 items-center justify-between flex-wrap">
        <div className="flex gap-4 items-center">
          <div className="flex gap-2 items-center">
            <span className="text-xs text-muted-foreground">Type:</span>
            <div className="flex gap-1">
              {(['Line', 'Area', 'Baseline'] as ChartType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => handleTypeChange(type)}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    chartType === type
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 items-center">
            <span className="text-xs text-muted-foreground">Scale:</span>
            <div className="flex gap-1">
              {(['auto', 'percentage'] as ScaleMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setScaleMode(mode)}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    scaleMode === mode
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  }`}
                >
                  {mode === 'auto' ? 'Auto' : '% View'}
                </button>
              ))}
            </div>
          </div>

          {/* RLB Price Toggle */}
          {secondaryData && showSecondary && (
            <div className="flex gap-2 items-center">
              <button
                onClick={() => setRlbPriceVisible(!rlbPriceVisible)}
                className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                  rlbPriceVisible
                    ? 'bg-orange-500 text-white'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }`}
              >
                <span style={{ color: rlbPriceVisible ? 'white' : secondaryColor }}>●</span>
                RLB Price
              </button>
            </div>
          )}
        </div>

        {/* Data Statistics */}
        {dataStats && (
          <div className="flex gap-3 text-xs">
            <span className="text-muted-foreground">
              Range: <span className={dataStats.range === 0 ? 'text-yellow-600 font-semibold' : 'text-foreground'}>
                ${dataStats.range.toFixed(2)}
              </span>
            </span>
            <span className="text-muted-foreground">
              Min: <span className="text-foreground">${dataStats.min.toFixed(2)}</span>
            </span>
            <span className="text-muted-foreground">
              Max: <span className="text-foreground">${dataStats.max.toFixed(2)}</span>
            </span>
          </div>
        )}
      </div>

      {/* Warning for flat or minimal variation data */}
      {dataStats && dataStats.range === 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-2">
          <p className="text-xs text-yellow-800 dark:text-yellow-200">
            ⚠️ No variation in data - all values are identical (${dataStats.avg.toFixed(2)}). Chart will show a flat line.
          </p>
        </div>
      )}
      {dataStats && dataStats.range > 0 && dataStats.range < dataStats.avg * 0.01 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-2">
          <p className="text-xs text-blue-800 dark:text-blue-200">
            💡 Very small variation detected ({((dataStats.range / dataStats.avg) * 100).toFixed(3)}%). Use &quot;% View&quot; scale mode to zoom into changes.
          </p>
        </div>
      )}

      {/* Chart */}
      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
}

/**
 * Speed against quality, the way Artificial Analysis plots it. Points come from
 * whichever source tab is active, so a chart never silently mixes the two.
 *
 * ECharts is imported piecewise to keep the Pages bundle small.
 */

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import type { MetricSource, SourcedRow } from '@shared/leaderboard-types';
import { metricValue } from '@shared/compare';
import * as echarts from 'echarts/core';
import { ScatterChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { LabelLayout } from 'echarts/features';
import { columnFor, type MetricKey } from '../core/columns';
import { LeaderboardStore } from '../core/leaderboard.store';

echarts.use([ScatterChart, GridComponent, TooltipComponent, CanvasRenderer, LabelLayout]);

interface Point {
  label: string;
  x: number;
  y: number;
}

@Component({
  selector: 'app-scatter-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <h2 class="text-sm font-medium text-neutral-300">{{ title() }}</h2>
      @if (points().length >= 2) {
        <div #host class="mt-2 h-72 w-full"></div>
      } @else {
        <p class="mt-6 pb-6 text-center text-sm text-neutral-500">
          Needs at least two models with both {{ xLabel() }} and {{ yLabel() }} from this source.
        </p>
      }
    </div>
  `,
})
export class ScatterPlot {
  readonly source = input.required<MetricSource>();
  readonly xKey = input<MetricKey>('outputTokensPerSecond');
  readonly yKey = input<MetricKey>('intelligenceIndex');

  private readonly store = inject(LeaderboardStore);
  private readonly host = viewChild<ElementRef<HTMLDivElement>>('host');
  private chart: echarts.ECharts | null = null;

  protected readonly xLabel = computed(() => columnFor(this.xKey()).label);
  protected readonly yLabel = computed(() => columnFor(this.yKey()).label);
  protected readonly title = computed(() => `${this.yLabel()} vs ${this.xLabel()}`);

  protected readonly points = computed<Point[]>(() => {
    const source = this.source();
    const [xk, yk] = [this.xKey() as keyof SourcedRow, this.yKey() as keyof SourcedRow];

    return this.store
      .entries()
      .map((e) => ({
        label: e.label,
        x: metricValue(e.bySource[source], xk),
        y: metricValue(e.bySource[source], yk),
      }))
      .filter((p): p is Point => p.x !== null && p.y !== null);
  });

  constructor() {
    effect((onCleanup) => {
      const el = this.host()?.nativeElement;
      const data = this.points();
      if (!el || data.length < 2) return;

      this.chart ??= echarts.init(el, undefined, { renderer: 'canvas' });
      this.chart.setOption(this.buildOption(data), true);

      const observer = new ResizeObserver(() => this.chart?.resize());
      observer.observe(el);
      onCleanup(() => observer.disconnect());
    });
  }

  ngOnDestroy(): void {
    this.chart?.dispose();
    this.chart = null;
  }

  private buildOption(data: Point[]): echarts.EChartsCoreOption {
    const axis = {
      axisLine: { lineStyle: { color: '#404040' } },
      axisLabel: { color: '#a3a3a3' },
      splitLine: { lineStyle: { color: '#262626' } },
      nameTextStyle: { color: '#737373' },
    };

    return {
      grid: { left: 56, right: 24, top: 24, bottom: 48 },
      tooltip: {
        trigger: 'item',
        backgroundColor: '#171717',
        borderColor: '#404040',
        textStyle: { color: '#e5e5e5' },
        formatter: (p: { data: [number, number, string] }) =>
          `<b>${p.data[2]}</b><br/>${this.xLabel()}: ${p.data[0].toFixed(1)}<br/>${this.yLabel()}: ${p.data[1].toFixed(1)}`,
      },
      xAxis: { type: 'value', name: this.xLabel(), nameLocation: 'middle', nameGap: 30, scale: true, ...axis },
      yAxis: { type: 'value', name: this.yLabel(), nameLocation: 'middle', nameGap: 40, scale: true, ...axis },
      series: [
        {
          type: 'scatter',
          symbolSize: 14,
          itemStyle: { color: '#22d3ee' },
          label: {
            show: true,
            position: 'right',
            color: '#d4d4d4',
            fontSize: 11,
            formatter: (p: { data: [number, number, string] }) => p.data[2],
          },
          labelLayout: { hideOverlap: true },
          data: data.map((p) => [p.x, p.y, p.label]),
        },
      ],
    };
  }
}

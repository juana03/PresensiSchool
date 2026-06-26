import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { motion } from 'motion/react';

interface HeatmapProps {
  data: { date: string; count: number }[];
}

export default function AttendanceHeatmap({ data }: HeatmapProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const width = 300 - margin.left - margin.right;
    const height = 150 - margin.top - margin.bottom;

    // Clear previous
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Group by month/day of week
    const cellSize = 12;
    const weekDays = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

    // For a simple monthly heatmap, we'll just show the last 30 days in a grid
    const colorScale = d3.scaleSequential(d3.interpolateBlues)
      .domain([0, d3.max(data, d => d.count) || 10]);

    svg.selectAll("rect")
      .data(data)
      .enter()
      .append("rect")
      .attr("width", cellSize - 1)
      .attr("height", cellSize - 1)
      .attr("x", (_d, i) => Math.floor(i / 7) * cellSize)
      .attr("y", (_d, i) => (i % 7) * cellSize)
      .attr("fill", d => colorScale(d.count))
      .attr("rx", 2)
      .attr("ry", 2)
      .append("title")
      .text(d => `${d.date}: ${d.count} Hadir`);

    // Add labels
    svg.selectAll(".label")
      .data(weekDays)
      .enter()
      .append("text")
      .attr("x", -15)
      .attr("y", (_d, i) => i * cellSize + 9)
      .attr("font-size", "7px")
      .attr("fill", "#64748b")
      .text(d => d);

  }, [data]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm"
    >
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Heatmap Kehadiran (30 Hari Terakhir)</h4>
      <div className="flex justify-center">
        <svg ref={svgRef}></svg>
      </div>
      <div className="mt-2 flex items-center justify-center gap-2">
        <span className="text-[8px] text-slate-400">Rendah</span>
        <div className="flex gap-0.5">
           {[0, 0.25, 0.5, 0.75, 1].map(v => (
             <div key={v} className="w-2 h-2 rounded-xs" style={{ backgroundColor: d3.interpolateBlues(v) }}></div>
           ))}
        </div>
        <span className="text-[8px] text-slate-400">Tinggi</span>
      </div>
    </motion.div>
  );
}

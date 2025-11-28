import React, { useMemo } from 'react';
import { useCollectionStore } from '../store/useCollectionStore';
import { useThemeStore } from '../store/useThemeStore';
import { AIConfigPanel } from '../components/AIConfigPanel';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { CollectionCategory } from '../types/types';
import clsx from 'clsx';

// Helper to get colors from CSS variables would be ideal, but for now we can use a map or just standard colors that work on both
// or rely on the fact that we can pass CSS variables to some SVG props.
// Recharts 2.x+ generally supports CSS variables in string props.

export const DashboardPage: React.FC = () => {
  const { getStats, collection } = useCollectionStore();
  const { theme } = useThemeStore();
  const stats = getStats();

  const pieData = [
    { name: 'Watched', value: stats.watched, color: '#22c55e' },
    { name: 'To Watch', value: stats.toWatch, color: '#3b82f6' },
    { name: 'Favorites', value: stats.favorites, color: '#ef4444' },
  ].filter(d => d.value > 0);

  // Calculate types distribution
  const typeData = Object.values(collection.reduce((acc, item) => {
      acc[item.type] = acc[item.type] || { name: item.type, count: 0 };
      acc[item.type].count++;
      return acc;
  }, {} as Record<string, { name: string; count: number }>));

  // Dynamic styles for charts based on CSS variables
  // We can't easily use CSS variables in JS objects for Recharts without computing them.
  // However, we can use a small mapping or just use "currentColor" where supported.
  // For simplicity and reliability, let's just use a hook to get the computed style or simple conditional.
  // Since we have specific themes, let's just use a simple lookup for chart specific colors if needed,
  // or use CSS variables directly in string props which usually works for SVG attributes.
  
  const chartStyles = {
    text: 'var(--text-secondary)',
    grid: 'var(--border-color)',
    tooltipBg: 'var(--bg-surface)',
    tooltipBorder: 'var(--border-color)',
    tooltipText: 'var(--text-primary)',
    barFill: 'var(--accent-primary)',
    pieStroke: 'var(--bg-surface)'
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold mb-8 text-theme-accent">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="p-6 rounded-xl shadow-sm border bg-theme-surface border-theme-border">
            <h3 className="text-sm font-medium text-theme-subtext">Total Collection</h3>
            <p className="text-4xl font-bold mt-2 text-theme-text">{stats.total}</p>
        </div>
        <div className="p-6 rounded-xl shadow-sm border bg-theme-surface border-theme-border">
            <h3 className="text-sm font-medium text-theme-subtext">Completed</h3>
            <p className="text-4xl font-bold text-green-600 mt-2">{stats.watched}</p>
        </div>
        <div className="p-6 rounded-xl shadow-sm border bg-theme-surface border-theme-border">
            <h3 className="text-sm font-medium text-theme-subtext">To Watch</h3>
            <p className="text-4xl font-bold text-blue-600 mt-2">{stats.toWatch}</p>
        </div>
      </div>

      {/* AI Configuration Panel */}
      <div className="mb-8">
        <AIConfigPanel />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Status Distribution */}
        <div className="p-6 rounded-xl shadow-sm border h-[400px] bg-theme-surface border-theme-border">
            <h3 className="text-lg font-bold mb-6 text-theme-text">Collection Status</h3>
            {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                            stroke={chartStyles.pieStroke}
                        >
                            {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: chartStyles.tooltipBg,
                            borderColor: chartStyles.tooltipBorder,
                            color: chartStyles.tooltipText
                          }}
                          itemStyle={{ color: chartStyles.tooltipText }}
                        />
                        <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-theme-subtext">
                    No data available
                </div>
            )}
        </div>

        {/* Type Distribution */}
        <div className="p-6 rounded-xl shadow-sm border h-[400px] bg-theme-surface border-theme-border">
             <h3 className="text-lg font-bold mb-6 text-theme-text">Media Types</h3>
             {typeData.length > 0 ? (
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={typeData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartStyles.grid} />
                        <XAxis 
                          dataKey="name" 
                          tick={{fontSize: 12, fill: chartStyles.text}} 
                          interval={0} 
                          angle={-30} 
                          textAnchor="end" 
                          height={60}
                        />
                        <YAxis 
                          allowDecimals={false} 
                          tick={{fill: chartStyles.text}}
                        />
                        <Tooltip 
                          cursor={{fill: 'var(--bg-secondary)'}}
                          contentStyle={{ 
                            backgroundColor: chartStyles.tooltipBg,
                            borderColor: chartStyles.tooltipBorder,
                            color: chartStyles.tooltipText
                          }}
                          itemStyle={{ color: chartStyles.tooltipText }}
                        />
                        <Bar dataKey="count" fill={chartStyles.barFill} radius={[4, 4, 0, 0]} />
                    </BarChart>
                 </ResponsiveContainer>
             ) : (
                <div className="h-full flex items-center justify-center text-theme-subtext">
                    No data available
                </div>
             )}
        </div>
      </div>
    </div>
  );
};

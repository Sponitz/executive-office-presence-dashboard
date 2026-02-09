import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface WeeklyTrendChartProps {
  data: Array<{
    date: string;
    visitors: number;
  }>;
}

export function WeeklyTrendChart({ data }: WeeklyTrendChartProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Daily Attendance (Last 30 Days)</h3>
      <div className="h-72">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            No attendance data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#005596" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#005596" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="date" 
                stroke="#64748b" 
                fontSize={12} 
                tickFormatter={formatDate}
                interval="preserveStartEnd"
              />
              <YAxis stroke="#64748b" fontSize={12} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                              }}
                              labelFormatter={(label) => formatDate(String(label))}
                              formatter={(value) => [value, 'Unique Visitors']}
                            />
              <Area
                type="monotone"
                dataKey="visitors"
                name="Visitors"
                stroke="#005596"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorVisitors)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

interface OfficeComparisonChartProps {
  data: Array<{
    name: string;
    current: number;
    capacity: number;
    occupancyRate: number;
  }>;
}

export function OfficeComparisonChart({ data }: OfficeComparisonChartProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Office Comparison</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 10, right: 10, left: 80, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
            <XAxis type="number" stroke="#64748b" fontSize={12} />
            <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={12} width={75} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
              formatter={(value, name) => [
                value,
                name === 'current' ? 'Current' : 'Capacity',
              ]}
            />
            <Bar dataKey="current" name="Current" fill="#005596" radius={[0, 4, 4, 0]} />
            <Bar dataKey="capacity" name="Capacity" fill="#A7A8A9" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface HeatmapData {
  hour: number;
  dayOfWeek: number;
  averageOccupancy: number;
}

interface PeakHoursHeatmapProps {
  data: HeatmapData[];
  maxOccupancy: number;
}

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hours = Array.from({ length: 24 }, (_, i) => i);

export function PeakHoursHeatmap({ data, maxOccupancy }: PeakHoursHeatmapProps) {
  const getColor = (value: number) => {
    if (value === 0) return 'bg-slate-100';
    const intensity = value / maxOccupancy;
    if (intensity < 0.2) return 'bg-[#4597D3]/20';
    if (intensity < 0.4) return 'bg-[#4597D3]/40';
    if (intensity < 0.6) return 'bg-[#4597D3]/60';
    if (intensity < 0.8) return 'bg-[#005596]/70';
    return 'bg-[#005596]';
  };

  const getValue = (day: number, hour: number) => {
    const cell = data.find((d) => d.dayOfWeek === day && d.hour === hour);
    return cell?.averageOccupancy || 0;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Peak Hours Heatmap</h3>
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="flex">
            <div className="w-12" />
            {hours.filter((h) => h >= 6 && h <= 20).map((hour) => (
              <div key={hour} className="flex-1 text-center text-xs text-slate-500 pb-2">
                {hour}:00
              </div>
            ))}
          </div>
          {days.map((day, dayIndex) => (
            <div key={day} className="flex items-center">
              <div className="w-12 text-xs text-slate-500 pr-2">{day}</div>
              {hours.filter((h) => h >= 6 && h <= 20).map((hour) => {
                const value = getValue(dayIndex, hour);
                return (
                  <div
                    key={`${day}-${hour}`}
                    className={`flex-1 h-8 m-0.5 rounded ${getColor(value)} transition-colors`}
                    title={`${day} ${hour}:00 - ${value} people`}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 mt-4">
          <span className="text-xs text-slate-500">Low</span>
          <div className="flex gap-1">
            <div className="w-4 h-4 rounded bg-slate-100" />
            <div className="w-4 h-4 rounded bg-[#4597D3]/20" />
            <div className="w-4 h-4 rounded bg-[#4597D3]/40" />
            <div className="w-4 h-4 rounded bg-[#4597D3]/60" />
            <div className="w-4 h-4 rounded bg-[#005596]/70" />
            <div className="w-4 h-4 rounded bg-[#005596]" />
          </div>
          <span className="text-xs text-slate-500">High</span>
        </div>
      </div>
    </div>
  );
}

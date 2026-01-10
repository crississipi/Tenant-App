"use client"

import { ChartProps } from '@/types';
import { FaFaucetDrip } from 'react-icons/fa6';
import { MdOutlineElectricalServices } from 'react-icons/md';
import { RiCoinsFill } from 'react-icons/ri';
import { Bar, BarChart, Brush, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, TooltipProps, XAxis, YAxis } from 'recharts';

interface CustomizedLabelProps {
  x?: number;
  y?: number;
  stroke?: string;
  value?: number | string;
}

interface SummaryLineChartProps {
  data: ChartProps[];
  title: string;
  filterValue: number;
  genAve: number;
}

type CustomTooltipProps = {
  active?: boolean;
  payload?: readonly {
    value: number;
    name: string;
    color?: string;
  }[];
  label?: string | number;
};

type TooltipPayload = ReadonlyArray<any>;

type Coordinate = {
  x: number;
  y: number;
};

type PieSectorData = {
  percent?: number;
  name?: string | number;
  midAngle?: number;
  middleRadius?: number;
  tooltipPosition?: Coordinate;
  value?: number;
  paddingAngle?: number;
  dataKey?: string | number | ((obj: any) => any);
  payload?: any;
  tooltipPayload?: any;
};

type GeometrySector = {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
};

type PieLabelProps = PieSectorData &
  GeometrySector & {
    tooltipPayload?: any;
  };

const RADIAN = Math.PI / 180;
// Updated colors to match the violet theme (White, Amber, Sky)
// Updated colors: Violet (Rent), Amber (Electric), Sky (Water)
const PIE_COLORS = ['#574964', '#fcd34d', '#7dd3fc'];

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 backdrop-blur-md text-customViolet p-3 rounded-2xl shadow-lg text-xs border border-white/20 z-50">
        <p className="font-bold mb-1">{label}</p>
        <p className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-customViolet"></span>
          Amount:
          <span className='font-bold'>
            {`₱${payload[0].value.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
          </span>
        </p>
      </div>
    );
  }
  return null;
};

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: PieLabelProps) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-(midAngle ?? 0) * RADIAN);
  const y = cy + radius * Math.sin(-(midAngle ?? 0) * RADIAN);

  return (
    <text x={x} y={y} fill="#574964" fontWeight={700} fontSize={10} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
      {`${((percent ?? 1) * 100).toFixed(0)}%`}
    </text>
  );
};

export default function SummaryLineChart({data, title, filterValue, genAve}: SummaryLineChartProps) {
  const CustomizedLabel: React.FC<CustomizedLabelProps> = ({ x, y, value }) => {
    return (
      <text
        x={x}
        y={y}
        dy={typeof value === "number" && value > genAve ? -10 : 20}
        fill={typeof value === "number" && value > genAve ? "#fca5a5" : "#6ee7b7"}
        fontSize={10}
        fontWeight={600}
        textAnchor="middle"
        className="drop-shadow-sm"
      >
        {value?.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </text>
    );
  };

  // Determine colors based on chart type
  const getLineColor = () => {
    if (title === 'Electric Bills') return '#f59e0b'; // Amber-500
    if (title === 'Water Bills') return '#0ea5e9'; // Sky-500
    return '#ffffff';
  };

  const getTickColor = () => {
    if (title === 'Electric Bills' || title === 'Water Bills') return '#9ca3af'; // Gray-400
    return '#ffffff';
  };

  return (
    <div className='w-full h-full mt-auto flex flex-col'>
        {title !== 'Expenses Average %' && (
          <div className='w-full flex justify-between p-2 pl-3 items-center mb-2'> 
              <span className={`flex items-center gap-2 font-bold text-lg tracking-tight ${title === 'Total Expenses' ? 'text-white' : 'text-gray-700'}`}>
                {title === 'Total Expenses' && <RiCoinsFill className='text-2xl opacity-80'/>}
                {title === 'Electric Bills' && <MdOutlineElectricalServices className='text-2xl opacity-80 text-amber-500'/>}
                {title === 'Water Bills' && <FaFaucetDrip className='text-xl ml-1 mt-1 opacity-80 text-sky-500'/>}
                {title}
              </span>
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%" className='w-full outline-none focus:outline-none'>
          {title === 'Water Bills' || title === 'Electric Bills' ? (
            <LineChart 
              width={500} 
              height={400} 
              data={data}
              margin={{
                top: 20,
                left: 10,
                right: 10,
                bottom: 0
              }}  
            >
              <XAxis 
                dataKey="name" 
                padding={ {left: 16, right: 16} } 
                tick={{ fill: getTickColor(), fontSize: 10, fontWeight: '600', opacity: 0.8 }} 
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                padding={{ top: 16, bottom: 16}} 
                hide={true}
                domain={['auto', 'auto']}
              />
              <Tooltip content={CustomTooltip} cursor={{ stroke: 'rgba(0,0,0,0.1)', strokeWidth: 2 }}/>
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={getLineColor()} 
                strokeWidth={3} 
                dot={{ r: 4, fill: getLineColor(), strokeWidth: 0 }}
                activeDot={{ r: 6, fill: getLineColor(), strokeWidth: 0 }} 
                label={<CustomizedLabel />}
              />
              <Brush height={0} startIndex={0} endIndex={filterValue}/>
            </LineChart>
          ) : 
          title === 'Total Expenses' ? (
            <BarChart
              width={500}
              height={400}
              data={data}
              margin={{
                top: 20,
                right: 10,
                left: 10,
                bottom: 0,
              }}
              barSize={32}
            >
              <XAxis 
                dataKey="name" 
                padding={{ left: 10, right: 10 }} 
                tick={{ fill: '#ffffff', fontSize: 11, fontWeight: '500', opacity: 0.9 }} 
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                padding={{ top: 0, bottom: 0}} 
                hide={true}
                domain={['auto', 'auto']}
              />
              <Tooltip content={CustomTooltip} cursor={{ fill: 'rgba(255,255,255,0.1)', radius: 8 }}/>
              <Bar 
                dataKey="value" 
                stackId="b" 
                fill="#ffffff" 
                radius={[8, 8, 8, 8]}
                label={filterValue < 6 ? { position: "top", fontSize: 10, fill: '#ffffff', fontWeight: 600, dy: -5 } : undefined}
              />
              <Brush height={0} startIndex={0} endIndex={filterValue}/>
            </BarChart>
          ) : 
          title === 'Expenses Average %' ? (
            <PieChart 
              width={200} 
              height={200}
              margin={{
                top: 0,
                right: 0,
                left: 0,
                bottom: 0,
              }}
            >
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                outerRadius={80}
                innerRadius={40}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${entry.name}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={CustomTooltip}/>
            </PieChart>
            ) : <></>
          }
          
        </ResponsiveContainer>
    </div>
  );
}
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

type CustomTooltipProps = TooltipProps<number, string> & {
  label?: string | number;
  payload?: {
    value: number;
    name: string;
    color: string;
  }[];
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
  dataKey?: string;
  payload?: any;
  tooltipPayload?: ReadonlyArray<TooltipPayload>;
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
const COLORS = ['#8884d8', 'oklch(82.8% 0.189 84.429)', 'oklch(82.8% 0.111 230.318)'];

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-800 text-white p-2 rounded-md text-sm">
        <p className="font-medium">{label}</p>
        <p>
          Amount:
          <span className='font-medium ml-3'>
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
    <text x={x} y={y} fill="white" fontWeight={500} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
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
        dy={typeof value === "number" && value > genAve ? -8 : 16}
        fill={typeof value === "number" && value > genAve ? "oklch(81% 0.117 11.638)" : "#5ee9b5"}
        fontSize={9}
        textAnchor="middle"
      >
        {value?.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </text>
    );
  };

  return (
    <div className='w-full h-full mt-auto flex flex-col'>
        {title !== 'Expenses Average %' && (
          <div className='w-full flex justify-between p-2 pl-3 items-center'> 
              <span className='flex items-center gap-2 text-white'>
                {title === 'Total Expenses' && <RiCoinsFill className='text-3xl'/>}
                {title === 'Electric Bills' && <MdOutlineElectricalServices className='text-2xl'/>}
                {title === 'Water Bills' && <FaFaucetDrip className='text-xl ml-1 mt-1'/>}
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
                top: 0,
                left: 0,
                right: 0,
                bottom: 0
              }}  
            >
              <XAxis 
                dataKey="name" 
                padding={ {left: 16, right: 16} } 
                tick={{ fill: '#ffffff', fontSize: 9, fontWeight: '500' }} 
                
              />
              <YAxis 
                padding={{ top: 16, bottom: 16}} 
                hide={false}
                axisLine={false}
                tickLine={false}
                tick={false} 
                width={0}
                domain={['auto', 'auto']}
              />
              <Tooltip content={CustomTooltip}/>
              <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} activeDot={{ r: 6 }} label={<CustomizedLabel />}/>
              <Brush height={0} startIndex={0} endIndex={filterValue}/>
            </LineChart>
          ) : 
          title === 'Total Expenses' ? (
            <BarChart
              width={500}
              height={400}
              data={data}
              margin={{
                top: 0,
                right: 0,
                left: 0,
                bottom: 0,
              }}
              barSize={'100%'}
            >
              <XAxis 
                dataKey="name" 
                padding={{ left: 10, right: 10 }} 
                tick={{ fill: '#ffffff', fontSize: 12, fontWeight: '400' }} 
              />
              <YAxis 
                padding={{ top: 0, bottom: 0}} 
                hide={false}
                axisLine={false}
                tickLine={false}
                tick={false} 
                width={0}
                domain={['auto', 'auto']}
              />
              <Tooltip content={CustomTooltip}/>
              <Bar dataKey="value" stackId="b" fill="#8884d8" label={filterValue < 6 ? { position: "center", fontSize: 12, fill: '#ffffff' } : undefined}/>
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
                outerRadius={70}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
            ) : <></>
          }
          
        </ResponsiveContainer>
    </div>
  );
}

export interface BillingSlipProps {
    billName: string;
    billAmount: number;
}
export interface NotifSlipProps{
    icon:string;
    message:string; 
    time:string;
}

export interface ChartProps {
    name: string;
    value: number;
    electric?: number;
    water?: number;
}

export interface SetPageProps {
    setPage: (page: number) => void;
}

export interface CustomInputProps {
    placeholder: string;
    inputType: string;
    marginBottom: boolean;
    hookValue: string;
    hookVariable: (hookValue: string) => void;
}

export interface ChangePageProps {
    setPage: (page: number) => void;
}

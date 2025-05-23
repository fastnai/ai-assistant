declare module '@fastn-ai/widget-react' {
  interface FastnWidgetProps {
    projectId: string;
    tenantId: string;
    authToken: any; // Auth object from react-oidc-context
    apiKey: string;
    theme?: 'light' | 'dark';
    env?: string;
    style?: React.CSSProperties;
  }

  const FastnWidget: React.FC<FastnWidgetProps>;
  export default FastnWidget;
} 
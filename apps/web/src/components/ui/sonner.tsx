import { Toaster as Sonner } from 'sonner';
import { useTheme } from '@/providers/theme';

type ToasterProps = React.ComponentProps<typeof Sonner>;

function Toaster(props: ToasterProps) {
  const { theme } = useTheme();
  return (
    <Sonner
      theme={theme as 'light' | 'dark'}
      className="toaster group"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'group rounded-xl border bg-card text-card-foreground shadow-lg',
          title: 'text-sm font-semibold',
          description: 'text-sm text-muted-foreground',
        },
      }}
      {...props}
    />
  );
}

export { Toaster };

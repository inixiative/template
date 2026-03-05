import * as React from 'react';
import type { ZodSchema } from 'zod';

type WizardStepDef = {
  label: string;
};

type WizardContextValue<TData extends Record<string, unknown>> = {
  currentStep: number;
  totalSteps: number;
  data: TData;
  setStepData: (stepIndex: number, value: unknown) => void;
  navigate: (stepDelta: number) => Promise<boolean>;
  validate: () => Promise<boolean>;
};

const WizardContext = React.createContext<WizardContextValue<Record<string, unknown>> | undefined>(undefined);

export type WizardProviderProps<TData extends Record<string, unknown>> = {
  steps: WizardStepDef[];
  initialStep?: number;
  initialData?: TData;
  stepSchemas?: Array<ZodSchema | undefined>;
  validateStep?: (stepIndex: number, data: TData) => boolean | Promise<boolean>;
  onComplete?: (data: TData) => void | Promise<void>;
  children: React.ReactNode;
};

export const WizardProvider = <TData extends Record<string, unknown>>({
  steps,
  initialStep = 0,
  initialData,
  stepSchemas,
  validateStep,
  onComplete,
  children,
}: WizardProviderProps<TData>) => {
  const totalSteps = steps.length;
  const [currentStep, setCurrentStep] = React.useState(Math.max(0, Math.min(initialStep, totalSteps - 1)));
  const [data, setData] = React.useState<TData>((initialData ?? ({} as TData)) as TData);

  const validate = React.useCallback(async () => {
    if (validateStep) {
      return validateStep(currentStep, data);
    }

    const stepSchema = stepSchemas?.[currentStep];
    if (!stepSchema) return true;

    const result = stepSchema.safeParse(data[currentStep]);
    return result.success;
  }, [currentStep, data, stepSchemas, validateStep]);

  const navigate = React.useCallback(
    async (stepDelta: number) => {
      const targetStep = currentStep + stepDelta;

      if (stepDelta > 0) {
        const isValid = await validate();
        if (!isValid) return false;
      }

      if (targetStep >= totalSteps) {
        await onComplete?.(data);
        return false;
      }

      if (targetStep < 0) {
        setCurrentStep(0);
        return true;
      }

      setCurrentStep(targetStep);
      return true;
    },
    [currentStep, data, onComplete, totalSteps, validate],
  );

  const setStepData = React.useCallback((stepIndex: number, value: unknown) => {
    setData((previous) => ({ ...previous, [stepIndex]: value }));
  }, []);

  return (
    <WizardContext.Provider
      value={{
        currentStep,
        totalSteps,
        data,
        setStepData,
        navigate,
        validate,
      }}
    >
      {children}
    </WizardContext.Provider>
  );
};

export const useWizard = <TData extends Record<string, unknown>>() => {
  const context = React.useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within WizardProvider');
  }
  return context as WizardContextValue<TData>;
};

export type WizardStepProps = {
  index: number;
  children: React.ReactNode;
  unmountWhenInactive?: boolean;
};

export const WizardStep = ({ index, children, unmountWhenInactive = true }: WizardStepProps) => {
  const { currentStep } = useWizard();
  const isActive = currentStep === index;

  if (!isActive && unmountWhenInactive) return null;

  return <div hidden={!isActive}>{children}</div>;
};

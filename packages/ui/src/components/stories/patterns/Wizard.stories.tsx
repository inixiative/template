import type { Story } from '@ladle/react';
import { useWizard, WizardProvider, WizardStep } from '@template/ui/components/compositions/WizardProvider';
import { Button } from '@template/ui/components/primitives/Button';
import { Stepper, type StepperStep } from '@template/ui/components/primitives/Stepper';
import { useMemo } from 'react';

const WizardControls = () => {
  const { currentStep, totalSteps, navigate } = useWizard();

  const steps = useMemo<StepperStep[]>(
    () =>
      ['Account', 'Details', 'Review'].map((label, index) => ({
        label,
        state: index < currentStep ? 'completed' : index === currentStep ? 'active' : 'upcoming',
      })),
    [currentStep],
  );

  return (
    <div className="space-y-4">
      <Stepper steps={[...steps]} mode="linear" />
      <div className="rounded-md border p-4 text-sm text-muted-foreground">
        Step {currentStep + 1} of {totalSteps}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => void navigate(-1)} disabled={currentStep === 0}>
          Back
        </Button>
        <Button onClick={() => void navigate(1)}>{currentStep === totalSteps - 1 ? 'Finish' : 'Next'}</Button>
      </div>
    </div>
  );
};

export const Wizard: Story = () => {
  return (
    <WizardProvider
      steps={[{ label: 'Account' }, { label: 'Details' }, { label: 'Review' }]}
      onComplete={() => {
        // Storybook-like action not required for this preview.
      }}
    >
      <div className="mx-auto max-w-xl space-y-4">
        <WizardControls />
        <WizardStep index={0}>
          <div className="rounded-md border p-4">Account step</div>
        </WizardStep>
        <WizardStep index={1}>
          <div className="rounded-md border p-4">Details step</div>
        </WizardStep>
        <WizardStep index={2}>
          <div className="rounded-md border p-4">Review step</div>
        </WizardStep>
      </div>
    </WizardProvider>
  );
};

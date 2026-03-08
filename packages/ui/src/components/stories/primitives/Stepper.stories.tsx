import type { Story } from '@ladle/react';
import { Stepper, type StepperStep } from '@template/ui/components/primitives/Stepper';
import { useState } from 'react';

const makeSteps = (activeIndex: number): StepperStep[] =>
  ['Account', 'Details', 'Review', 'Complete'].map((label, index) => ({
    label,
    state: index < activeIndex ? 'completed' : index === activeIndex ? 'active' : 'upcoming',
  }));

export const Linear: Story = () => {
  const [activeIndex, setActiveIndex] = useState(1);
  return <Stepper steps={[...makeSteps(activeIndex)]} mode="linear" onStepChange={setActiveIndex} />;
};

export const NonLinear: Story = () => {
  const [activeIndex, setActiveIndex] = useState(2);
  return <Stepper steps={[...makeSteps(activeIndex)]} mode="nonLinear" onStepChange={setActiveIndex} />;
};

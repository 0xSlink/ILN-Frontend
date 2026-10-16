import React from 'react';

export const ERROR_BOUNDARY_MESSAGE = 'Something went wrong loading this section.';

/** Gate that stays open until retry clears it (survives React 19 concurrent recovery). */
export function createThrowGate() {
  return { shouldThrow: true };
}

export function createThrowingComponent(
  gate: { shouldThrow: boolean },
  success: React.ReactNode,
  message = 'RPC unavailable'
) {
  return class ThrowingSection extends React.Component {
    override render() {
      if (gate.shouldThrow) {
        throw new Error(message);
      }
      return success;
    }
  };
}

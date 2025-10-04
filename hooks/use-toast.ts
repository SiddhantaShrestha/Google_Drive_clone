'use client';

import * as React from 'react';
import { toast as sonnerToast } from 'sonner';

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1000000;

type ToasterToast = {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'default' | 'destructive';
  className?: string;
};

const actionTypes = {
  ADD_TOAST: 'ADD_TOAST',
  UPDATE_TOAST: 'UPDATE_TOAST',
  DISMISS_TOAST: 'DISMISS_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST',
} as const;

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type ActionType = typeof actionTypes;

type Action =
  | {
      type: ActionType['ADD_TOAST'];
      toast: ToasterToast;
    }
  | {
      type: ActionType['UPDATE_TOAST'];
      toast: Partial<ToasterToast>;
    }
  | {
      type: ActionType['DISMISS_TOAST'];
      toastId?: ToasterToast['id'];
    }
  | {
      type: ActionType['REMOVE_TOAST'];
      toastId?: ToasterToast['id'];
    };

interface State {
  toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
const sonnerToastIds = new Map<string, string | number>();

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: 'REMOVE_TOAST',
      toastId: toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case 'UPDATE_TOAST':
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t,
        ),
      };

    case 'DISMISS_TOAST': {
      const { toastId } = action;

      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
              }
            : t,
        ),
      };
    }
    case 'REMOVE_TOAST':
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

type Toast = Omit<ToasterToast, 'id'>;

function toast({
  title,
  description,
  action,
  variant,
  className,
  ...props
}: Toast) {
  const id = genId();

  const update = (props: Partial<ToasterToast>) => {
    dispatch({
      type: 'UPDATE_TOAST',
      toast: { ...props, id },
    });

    const sonnerId = sonnerToastIds.get(id);
    if (sonnerId && props.title) {
      sonnerToast(props.title, {
        id: sonnerId,
        description: props.description,
        className: props.className,
      });
    }
  };

  const dismiss = () => {
    dispatch({ type: 'DISMISS_TOAST', toastId: id });

    const sonnerId = sonnerToastIds.get(id);
    if (sonnerId) {
      sonnerToast.dismiss(sonnerId);
      sonnerToastIds.delete(id);
    }
  };

  dispatch({
    type: 'ADD_TOAST',
    toast: {
      id,
      title,
      description,
      action,
      variant,
      className,
      ...props,
    },
  });

  // Create Sonner toast based on variant
  const sonnerId =
    variant === 'destructive'
      ? sonnerToast.error(title, {
          description,
          duration: TOAST_REMOVE_DELAY,
          className,
          action: action
            ? {
                label: action.label,
                onClick: action.onClick,
              }
            : undefined,
          onDismiss: () => dismiss(),
          onAutoClose: () => dismiss(),
        })
      : sonnerToast(title, {
          description,
          duration: TOAST_REMOVE_DELAY,
          className,
          action: action
            ? {
                label: action.label,
                onClick: action.onClick,
              }
            : undefined,
          onDismiss: () => dismiss(),
          onAutoClose: () => dismiss(),
        });

  sonnerToastIds.set(id, sonnerId);

  return {
    id: id,
    dismiss,
    update,
  };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => {
      dispatch({ type: 'DISMISS_TOAST', toastId });

      if (toastId) {
        const sonnerId = sonnerToastIds.get(toastId);
        if (sonnerId) {
          sonnerToast.dismiss(sonnerId);
          sonnerToastIds.delete(toastId);
        }
      } else {
        sonnerToast.dismiss();
        sonnerToastIds.clear();
      }
    },
  };
}

export { useToast, toast };

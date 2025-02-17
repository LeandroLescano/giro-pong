import {useState, useEffect, useRef} from "react";

interface KeyConfig {
  key: string | string[];
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
}

export const useKeyPress = (config: KeyConfig) => {
  const [keyPressed, setKeyPressed] = useState(false);
  const {key: targetKeys, ctrl, alt, shift} = config;
  const targetKeyArray = Array.isArray(targetKeys) ? targetKeys : [targetKeys];

  const handleKeyDown = (e: KeyboardEvent) => {
    const {key, ctrlKey, altKey, shiftKey} = e;

    if (targetKeyArray.includes(key)) {
      const match = targetKeyArray.some((targetKey) => {
        return (
          (!ctrl && !alt && !shift && key === targetKey) ||
          (ctrl && key === targetKey && ctrlKey === ctrl) ||
          (alt && key === targetKey && altKey === alt) ||
          (shift && key === targetKey && shiftKey === shift)
        );
      });
      if (match) setKeyPressed(true);
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    const {key, ctrlKey, altKey, shiftKey} = e;

    if (targetKeyArray.includes(key)) {
      const match = targetKeyArray.some((targetKey) => {
        return (
          (!ctrl && !alt && !shift && key === targetKey) ||
          (ctrl && key === targetKey && ctrlKey === ctrl) ||
          (alt && key === targetKey && altKey === alt) ||
          (shift && key === targetKey && shiftKey === shift)
        );
      });
      if (match) setKeyPressed(false);
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  return keyPressed;
};

export const useKeyHold = (config: KeyConfig, callback: () => void) => {
  const keyPressed = useKeyPress(config);
  const callbackRef = useRef(callback); // Use a ref to hold the callback

  useEffect(() => {
    callbackRef.current = callback; // Update the ref whenever the callback changes
  }, [callback]);

  useEffect(() => {
    let animationId: number | null = null;

    const handleFrame = () => {
      if (keyPressed) {
        callbackRef.current(); // Execute the latest callback
        animationId = requestAnimationFrame(handleFrame);
      } else {
        if (animationId) {
          cancelAnimationFrame(animationId);
          animationId = null;
        }
      }
    };

    if (keyPressed) {
      animationId = requestAnimationFrame(handleFrame);
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [keyPressed]);
};

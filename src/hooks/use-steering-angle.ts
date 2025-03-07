import {useEffect, useState} from "react";

export function useSteeringAngle(threshold: number = 40) {
  const [angle, setAngle] = useState(0);
  const [isNotHorizontal, setIsNotHorizontal] = useState(false);
  const [hasGyroscope, setHasGyroscope] = useState(true);

  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) {
        setHasGyroscope(false);
        setAngle(0);
        return;
      }

      setHasGyroscope(true);

      const isRight = event.gamma > 0;

      const anglePercentage = isRight
        ? (event.beta / -30) * 100
        : (event.beta / 30) * 100;
      const isTilted = event.beta > -80 && event.beta < 80;

      setAngle(anglePercentage);
      setIsNotHorizontal(isTilted);
    };

    window.addEventListener("deviceorientation", handleOrientation);
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [threshold]);

  return {angle, isNotHorizontal, hasGyroscope};
}

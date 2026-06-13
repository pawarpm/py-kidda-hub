type EyeTrackingControllerProps = {
  look: {
    x: number;
    y: number;
    speed: number;
    alert: boolean;
    active: boolean;
  };
};

function eyeTransform(look: EyeTrackingControllerProps['look'], strength = 1) {
  return `translate3d(${look.x * 16 * strength}px, ${look.y * 11 * strength}px, 0) scale(${look.alert ? 1.08 : 1})`;
}

export default function EyeTrackingController({ look }: EyeTrackingControllerProps) {
  return (
    <>
      <div
        className={`snake-eye-orb snake-eye-orb-left ${look.alert ? 'snake-eye-alert' : ''}`}
        style={{ transform: eyeTransform(look) }}
      >
        <span className="snake-pupil" style={{ transform: `translateX(${look.x * 4}px) scaleX(${look.alert ? 0.52 : 0.76})` }} />
      </div>
      <div
        className={`snake-eye-orb snake-eye-orb-right ${look.alert ? 'snake-eye-alert' : ''}`}
        style={{ transform: eyeTransform(look) }}
      >
        <span className="snake-pupil" style={{ transform: `translateX(${look.x * 4}px) scaleX(${look.alert ? 0.52 : 0.76})` }} />
      </div>
      <div className="snake-blink snake-blink-left" />
      <div className="snake-blink snake-blink-right" />
      <div className={`snake-alert-aura ${look.alert ? 'snake-alert-aura-on' : ''}`} />
    </>
  );
}

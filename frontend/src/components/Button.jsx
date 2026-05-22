import { useState } from "react";

/**
 * Button component with a ripple effect on click.
 * Wraps standard button props and styles.
 */
export default function Button({ children, style, onClick, ...props }) {
  const [ripples, setRipples] = useState([]);

  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate maximum distance to corners for perfect ripple size
    const width = rect.width;
    const height = rect.height;
    const maxRadius = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2));

    const newRipple = { x, y, size: maxRadius * 2, id: Date.now() };
    setRipples((prev) => [...prev, newRipple]);

    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 600); // match animation duration

    if (onClick) onClick(e);
  };

  return (
    <button
      style={{
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
      onClick={handleClick}
      {...props}
    >
      {children}
      {ripples.map((r) => (
        <span
          key={r.id}
          className="ripple-effect"
          style={{
            left: r.x,
            top: r.y,
            width: r.size,
            height: r.size,
          }}
        />
      ))}
    </button>
  );
}

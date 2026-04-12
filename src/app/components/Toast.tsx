"use client";

export default function Toast({ message }: { message: string }) {
  return (
    <div
      className={`fixed bottom-5 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-xl transition-all duration-300 ${
        message ? "translate-y-0 opacity-100" : "translate-y-16 opacity-0"
      } pointer-events-none z-50`}
    >
      {message}
    </div>
  );
}

// app/tailwind-test/page.tsx
export default function TailwindTest() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold text-indigo-700 mb-6">Tailwind is Working!</h1>
      
      <div className="bg-white border-2 border-dashed border-red-500 p-6 rounded-xl shadow-md max-w-md">
        <p className="text-gray-700 mb-4">
          If you see this styled box with:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-gray-600">
          <li>Indigo heading</li>
          <li>White background with shadow</li>
          <li>Red dashed border</li>
          <li>Proper padding and spacing</li>
        </ul>
      </div>

      <button className="mt-6 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors">
        Hover me
      </button>
    </div>
  );
}
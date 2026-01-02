﻿// app/page.tsx

import React from 'react';

const Page = () => {
  const columns = [
    { column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: 'gen_random_uuid()' },
    { column_name: 'title', data_type: 'text', is_nullable: 'NO', column_default: 'NULL' },
    { column_name: 'description', data_type: 'text', is_nullable: 'YES', column_default: 'NULL' },
    { column_name: 'host_id', data_type: 'uuid', is_nullable: 'YES', column_default: 'NULL' },
    { column_name: 'start_time', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: 'NULL' },
    { column_name: 'duration', data_type: 'integer', is_nullable: 'NO', column_default: 'NULL' },
    { column_name: 'max_attendees', data_type: 'integer', is_nullable: 'YES', column_default: '20' },
    { column_name: 'grief_types', data_type: 'ARRAY', is_nullable: 'YES', column_default: 'NULL' },
    { column_name: 'is_recurring', data_type: 'boolean', is_nullable: 'YES', column_default: 'false' },
    { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: 'now()' },
    { column_name: 'host_name', data_type: 'text', is_nullable: 'YES', column_default: 'NULL' },
    { column_name: 'image_url', data_type: 'text', is_nullable: 'YES', column_default: 'NULL' },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto bg-gray-50">
      <h1 className="text-2xl font-bold mb-4">Events Table Schema</h1>
      
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300 rounded-lg">
          <thead>
            <tr className="bg-gray-100">
              <th className="py-2 px-4 text-left font-semibold">Column Name</th>
              <th className="py-2 px-4 text-left font-semibold">Data Type</th>
              <th className="py-2 px-4 text-left font-semibold">Is Nullable</th>
              <th className="py-2 px-4 text-left font-semibold">Default Value</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((col, idx) => (
              <tr key={idx} className={`border-t ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                <td className="py-2 px-4">{col.column_name}</td>
                <td className="py-2 px-4">{col.data_type}</td>
                <td className="py-2 px-4">{col.is_nullable}</td>
                <td className="py-2 px-4"><code className="bg-gray-100 px-2 py-1 rounded">{col.column_default}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Page;
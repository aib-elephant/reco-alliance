"use client";

import Card from "../Card";

interface TableProps {
  data: Record<string, any>[];
}

const Table = ({ data }: TableProps) => {
  const headers = [...new Set(data.map((value) => Object.keys(value)))][0];

  return (
    <Card>
      <table className="w-full">
        <thead>
          <tr className="border-b border-neutral-200">
            {headers.map((h) => (
              <th
                key={h}
                className="uppercase text-start text-sm font-medium text-gray-400 py-2 px-3"
              >
                {h.replace(/ [^a-zA-Z0-9]/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((value, i) => {
            return (
              <tr key={i} className="border-b border-neutral-200 last:border-0">
                {headers.map((cell, i) => {
                  const val = value[cell];
                  return (
                    <td key={i} className="py-2 px-3">
                      {cell !== "status" ? (
                        val
                      ) : (
                        <span
                          className={`text-white rounded-full px-2 pb-0.5 text-sm ${val === "active" ? "bg-green-700" : "bg-red-600"}`}
                        >
                          {val}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
};

export default Table;

'use client';

import React from 'react';
import { format, isSameDay } from 'date-fns';

interface TabelSisaOrderProps {
  filteredData: any[];
  dateTo: string;
  parseDate: (value: any) => Date | null;
}

export default function TabelSisaOrder({
  filteredData,
  dateTo,
  parseDate,
}: TabelSisaOrderProps) {
  // ============================================
  // HITUNG DATA H-1
  // ============================================
  const dateToObj = dateTo ? new Date(dateTo) : new Date();
  const hMinus1 = new Date(dateToObj);
  hMinus1.setDate(hMinus1.getDate() - 1);

  const hMinus1Data = filteredData.filter((row: any) => {
    const dateCreated = parseDate(row['DATECREATED']);
    if (!dateCreated) return false;
    return isSameDay(dateCreated, hMinus1);
  });

  // ============================================
  // HITUNG DATA KENDALA
  // ============================================
  const calculateKendalaData = (data: any[]) => {
    const allowedStatus = ['CANCLWORK', 'STARTWORK', 'WORKFAIL'];
    const filtered = data.filter((row: any) => allowedStatus.includes(row['STATUS']));
    
    const districts = Array.from(new Set(filtered.map((row: any) => row['DISTRICT_TIF']))).filter(Boolean);
    
    const kendalaMap = new Map<string, Map<string, Map<string, number>>>();
    
    filtered.forEach((row: any) => {
      const district = row['DISTRICT_TIF'] || 'UNKNOWN';
      const status = row['STATUS'] || '';
      const errorCode = row['ERRORCODE_AKHIR'] || '';
      const subErrorCode = row['SUBERRORCODE_AKHIR'] || '';
      
      let category = errorCode;
      if (!category && status === 'STARTWORK') category = 'SISA PI H-1';
      if (!category && status === 'CANCLWORK') category = 'ORDER CANCEL H-1';
      if (!category) category = 'LAINNYA';
      
      let detail = subErrorCode;
      if (!detail && status === 'STARTWORK') detail = 'STARTWORK';
      if (!detail && status === 'CANCLWORK') detail = 'CANCELWORK';
      if (!detail) detail = 'KOSONG';
      
      if (!kendalaMap.has(category)) {
        kendalaMap.set(category, new Map());
      }
      const categoryMap = kendalaMap.get(category)!;
      if (!categoryMap.has(detail)) {
        categoryMap.set(detail, new Map());
      }
      const detailMap = categoryMap.get(detail)!;
      detailMap.set(district, (detailMap.get(district) || 0) + 1);
    });
    
    const categoryGrandTotal = new Map<string, number>();
    kendalaMap.forEach((categoryMap, category) => {
      let total = 0;
      categoryMap.forEach((detailMap) => {
        detailMap.forEach((count) => {
          total += count;
        });
      });
      categoryGrandTotal.set(category, total);
    });
    
    const sortedCategories = Array.from(kendalaMap.keys()).sort((a, b) => {
      if (a === 'ORDER CANCEL H-1') return -1;
      if (b === 'ORDER CANCEL H-1') return 1;
      return (categoryGrandTotal.get(b) || 0) - (categoryGrandTotal.get(a) || 0);
    });
    
    const result: any[] = [];
    const grandTotalPerDistrict: { [key: string]: number } = {};
    
    sortedCategories.forEach((category) => {
      const categoryMap = kendalaMap.get(category)!;
      
      const sortedDetails = Array.from(categoryMap.keys()).sort((a, b) => {
        const totalA = Array.from(categoryMap.get(a)!.values()).reduce((sum, val) => sum + val, 0);
        const totalB = Array.from(categoryMap.get(b)!.values()).reduce((sum, val) => sum + val, 0);
        return totalB - totalA;
      });
      
      sortedDetails.forEach((detail) => {
        const detailMap = categoryMap.get(detail)!;
        const row: any = {
          category,
          detail,
          districtData: {},
          grandTotal: 0,
        };
        
        detailMap.forEach((count, district) => {
          row.districtData[district] = count;
          row.grandTotal += count;
          grandTotalPerDistrict[district] = (grandTotalPerDistrict[district] || 0) + count;
        });
        
        result.push(row);
      });
    });
    
    const grandTotalOverall = Object.values(grandTotalPerDistrict).reduce((a, b) => a + b, 0);
    result.forEach(row => {
      row.percentage = grandTotalOverall > 0 ? (row.grandTotal / grandTotalOverall) * 100 : 0;
    });
    
    return {
      rows: result,
      districts,
      grandTotalOverall,
      grandTotalPerDistrict,
    };
  };

  const kendalaData = calculateKendalaData(hMinus1Data);
  const { rows: kendalaRows, districts, grandTotalOverall, grandTotalPerDistrict } = kendalaData;

  if (filteredData.length === 0 || kendalaRows.length === 0) {
    return null;
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="bg-white p-3 rounded-lg shadow-md overflow-x-auto mt-6">
      <h2 className="text-sm font-bold text-slate-800 mb-2">
        📋 SISA ORDER TIDAK PS H-1
      </h2>
      <p className="text-xs text-slate-500 mb-2">
        Data berdasarkan DATECREATED: {format(hMinus1, 'dd MMMM yyyy')}
      </p>
      <table className="w-full text-[10px] border-collapse">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="border border-slate-600 p-1 text-left font-bold align-middle">KATEGORI KENDALA</th>
            <th className="border border-slate-600 p-1 text-left font-bold align-middle">DETAIL KENDALA</th>
            {districts.map((d: string) => (
              <th key={d} className="border border-slate-600 p-1 text-center font-bold">{d}</th>
            ))}
            <th className="border border-slate-600 p-1 text-center font-bold">Grand Total</th>
            <th className="border border-slate-600 p-1 text-center font-bold">%</th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            const rowsWithSpan: any[] = [];
            let lastCategory = '';
            let categoryCount = 0;

            kendalaRows.forEach((row: any, idx: number) => {
              if (row.category !== lastCategory) {
                categoryCount = 1;
                lastCategory = row.category;
                for (let i = idx + 1; i < kendalaRows.length; i++) {
                  const next = kendalaRows[i];
                  if (next.category === row.category) categoryCount++;
                  else break;
                }
              }

              rowsWithSpan.push({
                ...row,
                idx,
                categoryCount,
                isFirstInCategory: row.category === lastCategory && (idx === 0 || kendalaRows[idx - 1]?.category !== row.category),
              });
            });

            let grandTotalAll = 0;
            kendalaRows.forEach(row => { grandTotalAll += row.grandTotal; });

            return (
              <>
                {rowsWithSpan.map((row: any) => {
                  const rowColor = row.idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                  
                  let categoryColor = 'text-slate-600';
                  if (row.category === 'SISA PI H-1') categoryColor = 'text-amber-600 font-bold';
                  else if (row.category === 'ORDER CANCEL H-1') categoryColor = 'text-red-600 font-bold';
                  else if (row.category === 'KENDALA PELANGGAN') categoryColor = 'text-violet-600';
                  else if (row.category === 'KENDALA TEKNIK') categoryColor = 'text-cyan-600';
                  
                  let percentColor = 'text-green-600';
                  if (row.percentage > 10) percentColor = 'text-red-600 font-bold';
                  else if (row.percentage > 5) percentColor = 'text-yellow-600 font-bold';

                  return (
                    <tr key={row.idx} className={`${rowColor} hover:bg-blue-50 transition-colors`}>
                      {row.isFirstInCategory ? (
                        <td rowSpan={row.categoryCount} className={`border border-slate-300 p-1 font-semibold align-middle ${categoryColor}`}>
                          {row.category}
                        </td>
                      ) : null}
                      <td className="border border-slate-300 p-1 text-slate-700">{row.detail}</td>
                      {districts.map((d: string) => (
                        <td key={d} className="border border-slate-300 p-1 text-center text-slate-600">
                          {row.districtData[d] || 0}
                        </td>
                      ))}
                      <td className="border border-slate-300 p-1 text-center font-bold text-blue-600">{row.grandTotal}</td>
                      <td className={`border border-slate-300 p-1 text-center font-bold ${percentColor}`}>
                        {row.percentage.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
                
                <tr className="bg-slate-200 font-bold hover:bg-slate-300 transition-colors">
                  <td colSpan={2} className="border border-slate-300 p-1 text-center text-slate-800">
                    GRAND TOTAL
                  </td>
                  {districts.map((d: string) => {
                    let districtTotal = 0;
                    kendalaRows.forEach(row => {
                      districtTotal += row.districtData[d] || 0;
                    });
                    return (
                      <td key={d} className="border border-slate-300 p-1 text-center text-slate-800">
                        {districtTotal}
                      </td>
                    );
                  })}
                  <td className="border border-slate-300 p-1 text-center text-blue-700">{grandTotalAll}</td>
                  <td className="border border-slate-300 p-1 text-center text-slate-800">100%</td>
                </tr>
              </>
            );
          })()}
        </tbody>
      </table>
    </div>
  );
}
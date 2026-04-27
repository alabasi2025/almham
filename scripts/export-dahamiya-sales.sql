SET NOCOUNT ON;
SELECT
  dt.Dt_ID               AS [رقم الفترة],
  dt.Yr_ID               AS [السنة],
  dt.Mon_ID              AS [الشهر],
  dt.Dt_Name             AS [اسم الفترة],
  CONVERT(NVARCHAR(10), dt.Dt_FromDate, 23) AS [من تاريخ],
  CONVERT(NVARCHAR(10), dt.Dt_ToDate, 23)   AS [إلى تاريخ],
  ISNULL(b.Bills, 0)     AS [عدد الفواتير],
  ISNULL(b.Kwh, 0)       AS [الاستهلاك كيلوواط],
  ISNULL(b.Sales, 0)     AS [إجمالي المبيعات],
  ISNULL(p.PayCount, 0)  AS [عدد التسديدات],
  ISNULL(p.Collected, 0) AS [إجمالي التحصيل],
  ISNULL(t.Taswih, 0)    AS [التسويات],
  ISNULL(b.Sales, 0) - ISNULL(p.Collected, 0) AS [الفرق (مبيعات - تحصيل)]
FROM DateTable dt
LEFT JOIN (
  SELECT Dt_ID, COUNT(*) AS Bills,
    CAST(SUM(Cst_MonthConsume) AS INT) AS Kwh,
    CAST(SUM(Cst_ConsumePrice + ISNULL(Cst_ConsumeAddedPrice,0)) AS DECIMAL(20,0)) AS Sales
  FROM BillAndRaedDataHistorical GROUP BY Dt_ID
) b ON b.Dt_ID = dt.Dt_ID
LEFT JOIN (
  SELECT Dt_ID, COUNT(*) AS PayCount,
    CAST(SUM(Pay_Mony) AS DECIMAL(20,0)) AS Collected
  FROM PaymentDataHistorical GROUP BY Dt_ID
) p ON p.Dt_ID = dt.Dt_ID
LEFT JOIN (
  SELECT Dt_ID, CAST(SUM(TwBd_TaswihValue) AS DECIMAL(20,0)) AS Taswih
  FROM TswBasicData GROUP BY Dt_ID
) t ON t.Dt_ID = dt.Dt_ID
ORDER BY dt.Dt_ID;

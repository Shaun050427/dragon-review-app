# 昨日涨停次日溢价数据接口

- 网页读数：`https://raw.githubusercontent.com/Shaun050427/dragon-review-app/market-data/yesterday-premium.json`。
- 发布位置：公开应用仓库的 `market-data` 分支；独立于保存私人复盘的 `dragon-review-data` 仓库，也不会每 5 分钟重新构建网站。
- 数据来源：AKShare `stock_zt_pool_previous_em(date=YYYYMMDD)`，底层来源东方财富“昨日涨停股池”。详见 [接口字段](https://akshare.akfamily.xyz/data/stock/stock.html#id142)。不需在设备输入股票代码。
- GitHub Actions 在工作日北京时间 09:27 起约每 5 分钟尝试采集。定时任务可能延迟或失败，页面显示快照交易日、采集时间、过期状态；页面每分钟检查新快照。公开快照通过 Git 提交留存历史。
- 指标：所有昨涨停股次日的**当前涨跌幅**中位数、正收益股票占比，以及昨日连板数≥2 的中位数。此字段是今日涨跌幅，不是开盘相对昨日收盘的竞价溢价，也不代表按涨停价买入能取得该收益。
- 正式交易前以券商行情终端核对。第三方接口字段变化、节假日和定时任务延迟时，旧数据保持显示并明确标为过期。

数据格式（供以后换行情提供方使用）：

```json
{
  "schemaVersion": 1,
  "tradeDate": "2026-09-18",
  "observedAt": "2026-09-18T09:37:00+08:00",
  "source": "AKShare stock_zt_pool_previous_em / 东方财富",
  "stocks": [
    { "code": "000001", "name": "示例股票", "changePct": 2.35, "lastPrice": 10.5, "yesterdayBoards": 2, "yesterdaySeal": "09:35:00", "sector": "示例行业" }
  ]
}
```

如需换数据供应商，只要脚本继续生成该 JSON 结构，前端不需要改动。注意示例仅展示格式，并非真实行情。`market-data` 分支初始是日期为 1970 年的空快照，页面会标为过期；首个交易日任务成功后才会出现真实行情。

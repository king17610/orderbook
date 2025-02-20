import React from "react";

/**
 * Quote 各檔位欄位 OrderBookRow
 * @param {object} props
 * @param {number} props.price 價格
 * @param {number} props.size 數量
 * @param {number} props.total 數量總和
 * @param {boolean} props.isNewOrder 是否是新訂單
 * @param {boolean} props.isSizeIncreased 是否數量增加
 * @param {boolean} props.isSizeDecreased 是否數量減少
 * @param {boolean} props.isAsk 是否為ask賣方
 * @param {number} props.totalPercent total % 
 */
const Quote = ({ price, size, total, isNewOrder, isSizeIncreased, isSizeDecreased, isAsk, totalPercent }) => {
  return (
    <div className={`quote ${isNewOrder ? (isAsk ? "asksNew" : "bidsNew") : ""}`}>
      <div className={`price ${isAsk ? "askColor" : "bidsColor"}`}>{price}</div>
      <div className={`size ${isSizeIncreased ? "isSizeIncreased" : ""} ${isSizeDecreased ? "isSizeDecreased" : ""}`}>
        {size}
      </div>
      <div
        className="total"
        style={{
          "--width": `${totalPercent * 100}%`,
          "--color": isAsk ? "rgba(255, 90, 90, 0.12)" : "rgba(16, 186, 104, 0.12)",
        }}
      >
        {total}
      </div>
    </div>
  );
};

export default Quote;

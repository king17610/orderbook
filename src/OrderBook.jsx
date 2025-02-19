import React, { useEffect, useState } from "react";
import "./OrderBook.scss";

function OrderBook() {
  const [currentPrice, setCurrentPrice] = useState();
  const [currentType, setCurrentType] = useState("");
  const [orderList, setOrderList] = useState({
    bids: {},
    asks: {},
  });

  useEffect(() => {
    const priceSocket = new WebSocket("wss://ws.btse.com/ws/futures");
    priceSocket.onopen = () => {
      priceSocket.send(
        JSON.stringify({
          op: "subscribe",
          args: ["tradeHistoryApi:BTCPFC"],
        })
      );
    };
    priceSocket.onmessage = (event) => {
      const res = JSON.parse(event.data);

      if (res.data && res.data.length > 0) {
        setCurrentPrice(
          res.data[0].price.toLocaleString("en-US", {
            minimumFractionDigits: 1, // 整數小數點補 0
          })
        );
        console.log(res.data[0].side);
        setCurrentType(res.data[0].side);
      }
    };
    priceSocket.onerror = (error) => console.error("WebSocket Error:", error);
    priceSocket.onclose = () => console.log("Price WebSocket Closed");

    const orderBookSocket = new WebSocket("wss://ws.btse.com/ws/oss/futures");
    orderBookSocket.onopen = () => {
      orderBookSocket.send(
        JSON.stringify({
          op: "subscribe",
          args: ["update:BTCPFC"],
        })
      );
    };

    orderBookSocket.onmessage = (event) => {
      const { data } = JSON.parse(event.data);
      setOrderList((prevOrderList) => {
        // 使用函數式更新來確保獲取到最新的 state
        let updatedBids = { ...prevOrderList.bids };
        let updatedAsks = { ...prevOrderList.asks };
        let init = data?.type === "snapshot";

        // if (data?.type === "snapshot") {
        //   console.log("OrderBook Snapshot:", data);
        //   updatedAsks = {}; // 清空
        //   updatedBids = {}; // 清空
        // }

        if (data?.bids.length > 0) {
          updatedBids = handleQuickList(data.bids, updatedBids, init);
        }

        if (data?.asks.length > 0) {
          updatedAsks = handleQuickList(data.asks, updatedAsks, init);
        }

        // console.log("Updated Bids:", updatedBids);

        return {
          bids: updatedBids,
          asks: updatedAsks,
        };
      });
    };

    orderBookSocket.onerror = (error) => console.error("OrderBook WebSocket Error:", error);
    orderBookSocket.onclose = () => console.log("OrderBook WebSocket Closed");

    return () => {
      priceSocket.close();
      orderBookSocket.close();
    };
  }, []);

  const handleQuickList = (data, quickList, init) => {
    data.forEach(([price, size]) => {
      const sizeInt = parseInt(size);
      if (sizeInt === 0) {
        delete quickList[price]; // 刪除價格
      } else {
        const existing = quickList[price];

        quickList[price] = {
          size: sizeInt,
          isNew: init ? false : !existing,
          isUpdated: existing && existing.size !== sizeInt,
        };
      }
    });
  
    return quickList;
  };

  // 移除掉animate class
  useEffect(() => {
    const timer = setTimeout(() => {
      setOrderList((prevOrderList) => {
        let updatedBids = { ...prevOrderList.bids };
        let updatedAsks = { ...prevOrderList.asks };

        Object.keys(updatedBids).forEach((price) => {
          updatedBids[price] = { ...updatedBids[price], isNew: false, isUpdated: false };
        });

        Object.keys(updatedAsks).forEach((price) => {
          updatedAsks[price] = { ...updatedAsks[price], isNew: false, isUpdated: false };
        });

        return { bids: updatedBids, asks: updatedAsks };
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [orderList]);

  return (
    <div className="orderBlock">
      <div className="header">Order Book</div>
      <div className="columnHeader">
        <div className="prize">Price(USD)</div>
        <div className="size">Size</div>
        <div className="total">Total</div>
      </div>
      <div className="quoteList sellQuote">
        {Object.entries(orderList.asks)
          .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
          .slice(-8)
          .map(([prize, { size, isNew, isUpdated }], index) => (
            <div className={`quote ${isNew ? "new" : ""}`} key={index}>
              <div className="prize">{prize}</div>
              <div className={`size ${isUpdated ? "updated" : ""}`}>{size}</div>
              <div className="total">{size}</div>
            </div>
          ))}
      </div>
      <div className={`current ${currentType === "BUY" ? "currentBuy" : "currentSell"}`}>{currentPrice}</div>

      <div className="quoteList buyQuote">
        {Object.entries(orderList.bids)
          .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
          .slice(0, 8)
          .map(([prize, { size, isNew, isUpdated }], index) => (
            <div className={`quote ${isNew ? "new" : ""}`} key={index}>
              <div className="prize">{prize}</div>
              <div className={`size ${isUpdated ? "updated" : ""}`}>{size}</div>
              <div className="total">{size}</div>
            </div>
          ))}
      </div>
    </div>
  );
}

export default OrderBook;

import React, { useEffect, useMemo, useState } from "react";
import "./OrderBook.scss";

function OrderBook() {
  const [currentPrice, setCurrentPrice] = useState();
  const [currentType, setCurrentType] = useState("");
  const [orderList, setOrderList] = useState({
    bids: {},
    asks: {},
  });

  useEffect(() => {
    // const priceSocket = new WebSocket("wss://ws.btse.com/ws/futures");
    // priceSocket.onopen = () => {
    //   priceSocket.send(
    //     JSON.stringify({
    //       op: "subscribe",
    //       args: ["tradeHistoryApi:BTCPFC"],
    //     })
    //   );
    // };
    // priceSocket.onmessage = (event) => {
    //   const res = JSON.parse(event.data);

    //   if (res.data && res.data.length > 0) {
    //     setCurrentPrice(
    //       res.data[0].price.toLocaleString("en-US", {
    //         minimumFractionDigits: 1, // 整數小數點補 0
    //       })
    //     );
    //     console.log(res.data[0].side);
    //     setCurrentType(res.data[0].side);
    //   }
    // };
    // priceSocket.onerror = (error) => console.error("WebSocket Error:", error);
    // priceSocket.onclose = () => console.log("Price WebSocket Closed");

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

        if (init) {
          updatedAsks = {};
          updatedBids = {};
        }

        if (data?.bids.length > 0) {
          updatedBids = handleQuickList(data.bids, updatedBids, init);
        }

        if (data?.asks.length > 0) {
          updatedAsks = handleQuickList(data.asks, updatedAsks, init);
        }

        return {
          bids: updatedBids,
          asks: updatedAsks,
        };
      });
    };

    orderBookSocket.onerror = (error) => console.error("OrderBook WebSocket Error:", error);
    orderBookSocket.onclose = () => console.log("OrderBook WebSocket Closed");

    return () => {
      // priceSocket.close();
      orderBookSocket.close();
    };
  }, []);

  const handleQuickList = (data, quickList, init) => {
    data.forEach(([price, size]) => {
      const sizeInt = parseInt(size);
      if (sizeInt === 0) {
        delete quickList[price];
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

        Object.keys(updatedAsks)
          .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
          .forEach((price) => {
            updatedAsks[price] = { ...updatedAsks[price], isNew: false, isUpdated: false };
          });

        return { bids: updatedBids, asks: updatedAsks };
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [orderList]);

  const asksList = useMemo(() => {
    let sortedAsks = Object.entries(orderList.asks)
      .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
      .slice(-8);

    let total = 0;

    return sortedAsks
      .reverse()
      .map(([price, data]) => {
        total += data.size;
        return {
          price,
          size: data.size,
          isNew: data.isNew,
          isUpdated: data.isUpdated,
          total,
        };
      })
      .reverse();
  }, [orderList.asks]);

  const bidsList = useMemo(() => {
    let sortedBids = Object.entries(orderList.bids)
      .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
      .slice(0, 8);

    let total = 0;
    return sortedBids.map(([price, data]) => {
      total += data.size;
      return {
        price,
        size: data.size,
        isNew: data.isNew,
        isUpdated: data.isUpdated,
        total,
      };
    });
  }, [orderList.bids]);

  return (
    <div className="orderBlock">
      <div className="header">Order Book</div>
      <div className="columnHeader">
        <div className="price">Price(USD)</div>
        <div className="size">Size</div>
        <div className="total">Total</div>
      </div>

      <div className="quoteList sellQuote">
        {asksList.map(({ price, size, isNew, isUpdated, total }, index) => {
          return (
            <div className={`quote ${isNew ? "asks-new" : ""}`} key={index}>
              <div className="price buyColor">
                {Number(price).toLocaleString("en-US", {
                  minimumFractionDigits: 1,
                })}
              </div>
              <div className={`size ${isUpdated ? "asks-updated" : ""}`}>{size.toLocaleString("en-US")}</div>
              <div
                className="total"
                style={{
                  "--width": `${(total / asksList[0].total) * 100}%`,
                  "--color": "rgba(255, 90, 90, 0.12)",
                }}
              >
                {total.toLocaleString("en-US")}
              </div>
            </div>
          );
        })}
      </div>

      <div className={`current ${currentType === "BUY" ? "currentBuy" : "currentSell"}`}>{currentPrice}</div>

      <div className="quoteList buyQuote">
        {bidsList.map(({ price, size, isNew, isUpdated, total }, index) => {
          return (
            <div className={`quote ${isNew ? "new" : ""}`} key={index}>
              <div className="price sellColor">
                {Number(price).toLocaleString("en-US", {
                  minimumFractionDigits: 1,
                })}
              </div>
              <div className={`size ${isUpdated ? "updated" : ""}`}>{size.toLocaleString("en-US")}</div>
              <div
                className="total"
                style={{
                  "--width": `${(total / bidsList[bidsList.length - 1].total) * 100}%`,
                  "--color": "rgba(16, 186, 104, 0.12)",
                }}
              >
                {total.toLocaleString("en-US")}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default OrderBook;

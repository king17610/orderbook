import React, { useEffect, useMemo, useRef, useState } from "react";
import "./OrderBook.scss";

function OrderBook() {
  const [currentPrice, setCurrentPrice] = useState(0);
  const [currentType, setCurrentType] = useState("");
  const [orderList, setOrderList] = useState({
    bids: {},
    asks: {},
  });
  const priceSocketRef = useRef(null);
  const orderBookSocketRef = useRef(null);
  const priceHeartbeatRef = useRef(null);
  const orderBookHeartbeatRef = useRef(null);
  const isUnmounted = useRef(false);
  const lastSeqNumRef = useRef(null);
  const priceReconnectAttemptRef = useRef(0);
  const orderBookReconnectAttemptRef = useRef(0);

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

  useEffect(() => {
    isUnmounted.current = false;

    const connectPriceSocket = () => {
      priceSocketRef.current = new WebSocket("wss://ws.btse.com/ws/futures");
      priceSocketRef.current.onopen = () => {
        priceSocketRef.current.send(
          JSON.stringify({
            op: "subscribe",
            args: ["tradeHistoryApi:BTCPFC"],
          })
        );

        // 使用心跳機制確保socket連線不中斷
        priceHeartbeatRef.current = setInterval(() => {
          if (priceSocketRef.current.readyState === WebSocket.OPEN) {
            priceSocketRef.current.send("ping");
          }
        }, 5000);
      };

      priceSocketRef.current.onmessage = (event) => {
        if (event.data === "pong") {
          return;
        }

        const res = JSON.parse(event.data);
        const { data } = res;
        if (data && data.length > 0) {
          setCurrentPrice((prevCurrentPrice) => {
            let mode = "";
            if (prevCurrentPrice) {
              if (data[0].price > prevCurrentPrice) {
                mode = "more";
              } else if (data[0].price < prevCurrentPrice) {
                mode = "less";
              } else {
                mode = "";
              }
            }

            setCurrentType(mode);

            return data[0].price;
          });
        }
      };

      priceSocketRef.current.onerror = (error) => console.error("PriceSocket Error:", error);
      priceSocketRef.current.onclose = () => {
        console.log("PriceSocket Closed");
        clearInterval(priceHeartbeatRef.current);

        if (!isUnmounted.current) {
          // 重新連線機制: 嘗試超過10次就不再嘗試 >>> do somthing ? pop up somthing msg ?
          if (priceReconnectAttemptRef.current >= 10) {
            console.error("PriceSocket Reconnected more than 10 times");
            return;
          }
          priceReconnectAttemptRef.current++;
          setTimeout(connectPriceSocket, 1000);
        }
      };
    };

    const connectOrderBookSocket = () => {
      orderBookSocketRef.current = new WebSocket("wss://ws.btse.com/ws/oss/futures");

      orderBookSocketRef.current.onopen = () => {
        orderBookSocketRef.current.send(
          JSON.stringify({
            op: "subscribe",
            args: ["update:BTCPFC"],
          })
        );

        // 使用心跳機制確保socket連線不中斷
        orderBookHeartbeatRef.current = setInterval(() => {
          if (orderBookSocketRef.current.readyState === WebSocket.OPEN) {
            orderBookSocketRef.current.send("ping");
          }
        }, 5000);
      };

      orderBookSocketRef.current.onmessage = (event) => {
        if (event.data === "pong") {
          return;
        }

        const { data } = JSON.parse(event.data);
        if (!data) return;

        // Re-subscribe topic to get new snapshot if prevSeqNum of new data doesn’t match last data’s seqNum
        if (lastSeqNumRef.current !== null && data.prevSeqNum !== lastSeqNumRef.current) {
          console.warn("WebSocket reconnect: prevSeqNum doesn’t match last data’s seqNum");
          orderBookSocketRef.current.close();
          return;
        }

        // the best bid higher or equal to the best ask
        if (data.bids.length > 0 && data.asks.length > 0) {
          const highestBid = parseFloat(data.bids[0][0]);
          const lowestAsk = parseFloat(data.asks[0][0]);

          if (highestBid >= lowestAsk) {
            console.warn("WebSocket reconnect: the best bid higher or equal to the best ask");
            orderBookSocketRef.current.close();
            return;
          }
        }

        setOrderList((prevOrderList) => {
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

        lastSeqNumRef.current = data.seqNum;
      };

      orderBookSocketRef.current.onerror = (error) => console.error("OrderBookSocket Error:", error);
      orderBookSocketRef.current.onclose = () => {
        console.log("OrderBookSocket Closed");
        clearInterval(orderBookHeartbeatRef.current);

        if (!isUnmounted.current) {
          // 重新連線機制: 嘗試超過10次就不再嘗試 >>> do somthing ? pop up somthing msg ?
          if (orderBookReconnectAttemptRef.current >= 10) {
            console.error("OrderBookSocket Reconnected more than 10 times");
            return;
          }

          orderBookReconnectAttemptRef.current++;
          setTimeout(connectOrderBookSocket, 1000);
        }
      };
    };

    connectPriceSocket();
    connectOrderBookSocket();

    return () => {
      isUnmounted.current = true;

      if (priceSocketRef.current) {
        priceSocketRef.current.close();
      }

      if (orderBookSocketRef.current) {
        orderBookSocketRef.current.close();
      }

      if (priceHeartbeatRef.current) {
        clearInterval(priceHeartbeatRef.current);
      }

      if (orderBookHeartbeatRef.current) {
        clearInterval(orderBookHeartbeatRef.current);
      }
    };
  }, []);

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

      <div className={`current ${currentType === "" ? "" : currentType === "more" ? "currentBuy" : "currentSell"}`}>
        <span>
          {currentPrice?.toLocaleString("en-US", {
            minimumFractionDigits: 1, // 整數小數點補 0
          })}
        </span>
        <div className="arrowBlock">
          <img
            className={`arrow ${currentType === "" ? "hidden" : currentType === "more" ? "arrowUp" : "arrowDown"}`}
          />
        </div>
      </div>

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

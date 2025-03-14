import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./OrderBook.scss";
import Quote from "./Quote";

/**
 * @typedef {Object} OrderData
 * @property {string} price - 價格
 * @property {number} size - 該檔位的數量
 * @property {boolean} isNewOrder - 是否為新資料
 * @property {boolean} isSizeIncreased - 檔位數量是否增加
 * @property {boolean} isSizeDecreased - 檔位數量是否減少
 * @property {number} total - 目前已累計的總數
 */

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
  const isUnmounted = useRef(false); // 判斷component是否卸載
  const lastSeqNumRef = useRef(null);
  const priceReconnectAttemptRef = useRef(0);
  const orderBookReconnectAttemptRef = useRef(0);

  const formatNumber = (number, minimumFractionDigits = 0) => {
    return number.toLocaleString("en-US", {
      minimumFractionDigits: minimumFractionDigits,
    });
  };

  const deepCopy = useCallback((inputObject) => {
    if (typeof inputObject !== "object" || inputObject === null) {
      return inputObject;
    }

    const outputObject = Array.isArray(inputObject) ? [] : {};

    for (let key in inputObject) {
      if (inputObject.hasOwnProperty(key)) {
        const value = inputObject[key];
        outputObject[key] = deepCopy(value);
      }
    }

    return outputObject;
  }, []);

  /**
   * 建立/更新快查表
   * @param {Array<Array<[string, string]>>} data - 各檔位的[price, size]陣列
   * @param {Object} quickList - 已更新的快查表
   * @param {boolean} init - 是否是snapShot
   * @returns {Object<string, { size: number, isNewOrder: boolean, isSizeIncreased: boolean, isSizeDecreased: boolean }>}
   * 快查表的每個價格對應的資料。價格作為鍵值，資料包含以下屬性：
   * @returns {number} quickList[price].size - 數量
   * @returns {boolean} quickList[price].isNewOrder - 是否是新資料
   * @returns {boolean} quickList[price].isSizeIncreased - 檔位數量是否增加
   * @returns {boolean} quickList[price].isSizeDecreased - 檔位數量是否減少
   */
  const handleQuickList = (data, quickList, init) => {
    data.forEach(([price, size]) => {
      const sizeInt = parseInt(size);
      if (sizeInt === 0) {
        delete quickList[price];
      } else {
        const existing = quickList[price];
        const isSizeIncreased = existing && sizeInt > existing.size;
        const isSizeDecreased = existing && sizeInt < existing.size;

        quickList[price] = {
          size: sizeInt,
          isNewOrder: init ? false : !existing,
          isSizeIncreased: isSizeIncreased,
          isSizeDecreased: isSizeDecreased,
        };
      }
    });

    return quickList;
  };

  /**
   * 計算並返回賣單asks的資料，排序並取出最後 8 筆資料。
   * @function
   * @returns {Array<OrderData>} 賣單資料列表
   */
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
          isNewOrder: data.isNewOrder,
          isSizeIncreased: data.isSizeIncreased,
          isSizeDecreased: data.isSizeDecreased,
          total,
        };
      })
      .reverse();
  }, [orderList.asks]);

  /**
   * 計算並返回買單bids的資料，經過排序並取出前 8 筆資料。
   * @function
   * @returns {Array<OrderData>} 買單資料列表，
   */
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
        isNewOrder: data.isNewOrder,
        isSizeIncreased: data.isSizeIncreased,
        isSizeDecreased: data.isSizeDecreased,
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
          let updatedBids = deepCopy(prevOrderList.bids);
          let updatedAsks = deepCopy(prevOrderList.asks);
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
        let updatedBids = deepCopy(prevOrderList.bids);
        let updatedAsks = deepCopy(prevOrderList.asks);

        Object.keys(updatedBids).forEach((price) => {
          updatedBids[price] = {
            ...updatedBids[price],
            isNewOrder: false,
            isSizeIncreased: false,
            isSizeDecreased: false,
          };
        });

        Object.keys(updatedAsks)
          .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
          .forEach((price) => {
            updatedAsks[price] = {
              ...updatedAsks[price],
              isNewOrder: false,
              isSizeIncreased: false,
              isSizeDecreased: false,
            };
          });

        return { bids: updatedBids, asks: updatedAsks };
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [orderList.asks, orderList.bids]);

  return (
    <div className="orderBlock">
      <div className="header">Order Book</div>
      <div className="columnHeader">
        <div className="price">Price(USD)</div>
        <div className="size">Size</div>
        <div className="total">Total</div>
      </div>

      <div className="quoteList">
        {asksList.map(({ price, size, isNewOrder, isSizeIncreased, isSizeDecreased, total }, index) => {
          return (
            <Quote
              key={index}
              price={formatNumber(Number(price), 1)}
              size={formatNumber(size)}
              total={formatNumber(total)}
              isNewOrder={isNewOrder}
              isSizeIncreased={isSizeIncreased}
              isSizeDecreased={isSizeDecreased}
              isAsk={true}
              totalPercent={total / bidsList[bidsList.length - 1].total}
            />
          );
        })}
      </div>

      <div className={`current ${currentType === "more" ? "currentBuy" : currentType === "less" ? "currentSell" : ""}`}>
        <span>{formatNumber(currentPrice, 1)}</span>
        <div className="arrowBlock">
          <img
            alt=""
            className={`arrow ${currentType === "more" ? "arrowUp" : currentType === "less" ? "arrowDown" : ""}`}
          />
        </div>
      </div>

      <div className="quoteList">
        {bidsList.map(({ price, size, isNewOrder, isSizeIncreased, isSizeDecreased, total }, index) => {
          return (
            <Quote
              key={index}
              price={formatNumber(Number(price), 1)}
              size={formatNumber(size)}
              total={formatNumber(total)}
              isNewOrder={isNewOrder}
              isSizeIncreased={isSizeIncreased}
              isSizeDecreased={isSizeDecreased}
              isAsk={false}
              totalPercent={total / asksList[0].total}
            />
          );
        })}
      </div>
    </div>
  );
}

export default OrderBook;

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
      const res = JSON.parse(event.data);
      if (res.data?.type === "snapshot") {
        console.log("OrderBook Snapshot:", res.data);
      }

      let updatedBids = orderList.bids;
      let updatedAsks =orderList.asks;

      if(res.data?.bids.length) {
        let accumulatedBidTotal = 0;
        res.data.bids.forEach(([price, size]) => {
          const sizeInt = parseInt(size);
    
          if (sizeInt === 0) {
            // 如果數量為 0，刪除該價格
            delete updatedBids[price];
          } else {
            accumulatedBidTotal += sizeInt;
            updatedBids[price] = { total: accumulatedBidTotal };
          }
        });
      }
  
     
      if(res.data?.asks.length) {
        let updatedAsks = {};
        let accumulatedAskTotal = 0;
        res.data.asks.reverse().forEach(([price, size]) => {
          const sizeInt = parseInt(size);
    
          if (sizeInt === 0) {
            delete updatedAsks[price];
          } else {
            accumulatedAskTotal += sizeInt;
            updatedAsks[price] = { total: accumulatedAskTotal };
          }
        });
      }

      console.log(updatedBids);
      setOrderList({
        bids: updatedBids,
        asks: updatedAsks,
      });
    }

    orderBookSocket.onerror = (error) => console.error("OrderBook WebSocket Error:", error);
    orderBookSocket.onclose = () => console.log("OrderBook WebSocket Closed");

    return () => {
      priceSocket.close();
      orderBookSocket.close();
    };
  }, []);

  return (
    <div className="orderBlock">
      <div className="header">Order Book</div>
      <div className="columnHeader">
        <div className="prize">Price(USD)</div>
        <div className="size">Size</div>
        <div className="total">Total</div>
      </div>
      <div className="quoteList sellQuote">
        {/* {asksList?.slice(-8)?.map((_, index) => (
          <div className="quote" key={index}>
            <div className="prize sellColor"> {_.prize}</div>
            <div className="size"> {_.size}</div>
            <div className="total"> {_.total}</div>
          </div>
        ))} */}
      </div>
      <div className={`current ${currentType === "BUY" ? "currentBuy" : "currentSell"}`}>{currentPrice}</div>

      <div className="quoteList buyQuote">
        {/* {bidsList?.slice(0,8)?.map((_, index) => (
          <div className="quote" key={index}>
            <div className="prize buyColor"> {_.prize}</div>
            <div className="size"> {_.size}</div>
            <div className="total"> {_.total}</div>
          </div>
        ))} */}
      </div>
    </div>
  );
}

export default OrderBook;

import React from "react";
import { Card, CardBody, Spacer } from "@nextui-org/react";
import "./library.css";

const CardComponent = () => {
  return (
    <>
      <Card className="py-6 px-6">
        <CardBody className="flex flex-col justify-center items-center text-center">
          <h1 className="text-3xl font-semibold mb-4">Welcome to Your Game Library!</h1>
          <p className="text-lg mb-6">Thank you for downloading Ascendara. Start by downloading a game to track its progress, or easily add a game you already have installed to your library.</p>
          <h2 className="font-bold text-xl">Your adventure starts now – let's make your gaming experience seamless and fun!</h2>
        </CardBody>
      </Card>
    </>
  );
};

export default CardComponent;

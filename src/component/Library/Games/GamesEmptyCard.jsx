import React from "react";
import { Card, CardBody, Spacer} from "@nextui-org/react";

const CardComponent = () => {
  return (
    <Card className="py-4 px-4">
      <CardBody className="">
            <h1 className="text-2-3 font">Getting ready to play...</h1>
        <Spacer y={2} />
            <p>Your game is downloading and preparing for launch. This could take a while.</p>
      </CardBody>
    </Card>
  );
};

export default CardComponent;
import React from "react";
import { Card, CardBody, Spacer} from "@nextui-org/react";

const CardComponent = () => {
  return (
    <Card className="py-4 px-4">
      <CardBody className="">
            <h1 className="text-2-3 font">Almost there...</h1>
        <Spacer y={2} />
            <h2>Hang on while your game downloads and extracts</h2>
      </CardBody>
    </Card>
  );
};

export default CardComponent;

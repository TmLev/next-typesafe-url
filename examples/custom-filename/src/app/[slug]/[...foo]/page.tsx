import { withParamValidation } from "next-typesafe-url/app/hoc";
import { InferPagePropsType } from "next-typesafe-url";
import { Route, RouteType } from "./route-type";
import { Client } from "./client";

type PageProps = InferPagePropsType<RouteType>;

let count = 0;

const Page = ({ routeParams, searchParams }: PageProps) => {
  console.log("render", count++);
  console.log(JSON.stringify(routeParams));
  console.log(JSON.stringify(searchParams));

  return (
    <>
      <div>{`data: ${JSON.stringify(routeParams)}`}</div>
      <br />
      <div>{`data: ${JSON.stringify(searchParams)}`}</div>
      <Client />
    </>
  );
};

export default withParamValidation(Page, Route);

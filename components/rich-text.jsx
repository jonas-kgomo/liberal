"use client";
import ReactMarkdown,{defaultUrlTransform} from "react-markdown";
import remarkGfm from "remark-gfm";

export default function RichText({children,className=""}){
 const source=typeof children==="string"?children:"";
 return <div className={"rich-text "+className}>
  <ReactMarkdown
   remarkPlugins={[remarkGfm]}
   skipHtml
   urlTransform={(url)=>defaultUrlTransform(url)}
   components={{
    a:({children,...props})=><a {...props} target="_blank" rel="noreferrer">{children}</a>,
    table:({children})=><div className="rich-table-scroll"><table>{children}</table></div>
   }}
  >{source}</ReactMarkdown>
 </div>;
}

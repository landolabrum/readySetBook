import styles from "./UiBarGraph.scss";
interface IUiBarGraphData {
    count: number;
    date?: string;
}
interface IUiBarGraph {
    data?: IUiBarGraphData[] | Record<string, IUiBarGraphData>;
    title?: string | React.ReactElement;
    height?: number | string;
    variant?: "default" | "progress" | "vertical";
}

const UiBarGraph = ({ data, title, height, variant = "default" }: IUiBarGraph) => {
    if (!data) return <></>;
    const dataObject: IUiBarGraphData[] = Array.isArray(data) ? data : Object.values(data);
    if (!dataObject.length) return <></>;

    const graphStyle =
        height
            ? { height: typeof height === "string" ? height : `${height}px` }
            : {};

    if (variant === "progress") {
        const current = dataObject?.[0]?.count || 0;
        const total = dataObject?.[1]?.count || current || 1;
        const percent = total > 0 ? Math.min((current / total) * 100, 100) : 0;
        const label = dataObject?.[0]?.date || "";
        return <>
            <style jsx>{styles}</style>
            <div className="bar-graph bar-graph--progress" style={graphStyle}>
                {title && <div className="bar-graph__header">
                    <div className="bar-graph__header--title">{title}</div>
                </div>}
                <div className="bar-graph__progress">
                    <div className="bar-graph__progress-track">
                        <div className="bar-graph__progress-fill" style={{ width: `${percent}%` }} />
                    </div>
                    {label && <div className="bar-graph__progress-label">{label}</div>}
                </div>
            </div>
        </>
    }

    if (variant === "vertical") {
        const max = dataObject.reduce((acc, curr) => Math.max(acc, Math.abs(curr.count)), 0) || 1;
        return <>
            <style jsx>{styles}</style>
            <div className="bar-graph bar-graph--vertical" style={graphStyle}>
                {title && <div className="bar-graph__header">
                    <div className="bar-graph__header--title">{title}</div>
                </div>}
                <div className="bar-graph__vertical-container">
                    {dataObject.map((item, idx) => {
                        const pct = (Math.abs(item.count) / max) * 100;
                        return <div key={idx} className="bar-graph__vertical-col">
                            <div className="bar-graph__vertical-value">{item.count}</div>
                            <div className="bar-graph__vertical-track">
                                <div
                                    className={`bar-graph__vertical-fill ${item.count >= 0 ? 'pos' : 'neg'}`}
                                    style={{ height: `${pct}%` }}
                                />
                            </div>
                            {item.date && <div className="bar-graph__vertical-label">{item.date}</div>}
                        </div>;
                    })}
                </div>
            </div>
        </>
    }

    const max = dataObject && dataObject.reduce((acc: number, curr: any) => {
        const value = curr.count;
        if (value > acc) {
            return value;
        } else {
            return acc;
        }
    }, -Infinity);
    const itemPercent = (item:any)=>(Math.abs(item.count) / max) * 100||0;


    return <>
        <style jsx>{styles}</style>
        <div className="bar-graph" style={graphStyle}>
            {title && <div className="bar-graph__header">
                <div className="bar-graph__header--title">{title}</div>
            </div>}
            <div className="bar-graph__container">
            <div className="bar-graph__container--content">
                {dataObject?.length && dataObject.map((item: any, key: number) => {
                    if(item?.date?.length>1)return <div key={key} className="bar-graph__content--column" data-key={item.date}>
                        <div className="column-container">
                            <div className="column-container__value">{item.count}</div>
                            {/* <div className={`graph-bar ${item.count > 0 ? "pos" : "neg"}`} style={{ height: `${(Math.abs(item.count) / max) * 100}%` }} /> */}
                            <div className={`graph-bar ${item.count > 0 ? "pos" : "neg"}`} style={{ width: `${itemPercent(item)}%` }} />
                            <div className={`graph-bar-mobile ${item.count > 0 ? "pos" : "neg"}`} style={{ width: `${itemPercent(item)}%` }} />
                        </div>
                        <div className="bar-graph__content--row">{item.date}</div>
                    </div>
                })}
            </div>
            </div>
        </div>
    </>
}
export default UiBarGraph;
// git change

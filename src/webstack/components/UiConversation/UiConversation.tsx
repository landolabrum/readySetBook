// Relative Path: ./UiConversation.tsx
import React from 'react';
import styles from './UiConversation.scss';
import UiMarkdown from '../UiMarkDown/controller/UiMarkDown';
import { useUser } from '~/src/core/authentication/hooks/useUser';

// Remember to create a sibling SCSS file with the same name as this component
interface IUiConversation {
    loading?: boolean;
    onMessageClick?: (message: any) => void;
    conversation: any; // Define the type based on your conversation data structure
}

const UiConversation = ({ conversation, loading, onMessageClick }: IUiConversation) => {
    const user = useUser();

    return (
        <>
            <style jsx>{styles}</style>{loading && "...loading conversation"}
            <div className="ui-conversation">
                <div className="ui-conversation--content">
                    {/* Render conversation data here */}
                    {conversation.map((message: any, index: number) => (
                        <div key={index} className={`ui-conversation__message ${message.sender.id === user?.id ? 'ui-conversation__message--own' : ''}`} onClick={() => { onMessageClick && onMessageClick(message) }}>
                            <div className="ui-conversation__sender">
                                {message.sender.name || message.sender.id}
                                {/* {JSON.stringify(message.sender)} */}
                                <div className="ui-conversation__timestamp">{message.sent}</div>
                                {/* {message.sender.alias || message.sender.id} */}
                            </div>
                            <div className="ui-conversation__body">{message?.body && <UiMarkdown text={message.body} />}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default UiConversation;
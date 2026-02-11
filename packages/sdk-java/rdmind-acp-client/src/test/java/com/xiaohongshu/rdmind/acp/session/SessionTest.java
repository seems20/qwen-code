package com.xiaohongshu.rdmind.acp.session;

import java.io.IOException;
import java.util.Collections;
import java.util.Optional;

import com.xiaohongshu.rdmind.acp.RDMindAcpClient;
import com.xiaohongshu.rdmind.acp.protocol.domain.client.ClientCapabilities;
import com.xiaohongshu.rdmind.acp.protocol.domain.client.ClientCapabilities.FileSystemCapability;
import com.xiaohongshu.rdmind.acp.protocol.domain.content.block.TextContent;
import com.xiaohongshu.rdmind.acp.protocol.domain.permission.PermissionOption;
import com.xiaohongshu.rdmind.acp.protocol.domain.permission.RequestPermissionOutcome;
import com.xiaohongshu.rdmind.acp.protocol.domain.session.update.AgentMessageChunkSessionUpdate;
import com.xiaohongshu.rdmind.acp.protocol.domain.session.update.AvailableCommandsUpdateSessionUpdate;
import com.xiaohongshu.rdmind.acp.protocol.domain.session.update.CurrentModeUpdateSessionUpdate;
import com.xiaohongshu.rdmind.acp.protocol.domain.session.update.PlanSessionUpdate;
import com.xiaohongshu.rdmind.acp.protocol.domain.session.update.ToolCallSessionUpdate;
import com.xiaohongshu.rdmind.acp.protocol.domain.session.update.ToolCallUpdateSessionUpdate;
import com.xiaohongshu.rdmind.acp.session.event.consumer.ContentEventSimpleConsumer;
import com.xiaohongshu.rdmind.acp.session.event.consumer.FileEventSimpleConsumer;
import com.xiaohongshu.rdmind.acp.utils.AgentInitializeException;
import com.xiaohongshu.rdmind.acp.protocol.agent.request.RequestPermissionRequest;
import com.xiaohongshu.rdmind.acp.protocol.agent.request.RequestPermissionRequest.RequestPermissionRequestParams;
import com.xiaohongshu.rdmind.acp.protocol.client.request.InitializeRequest.InitializeRequestParams;
import com.xiaohongshu.rdmind.acp.protocol.client.request.NewSessionRequest.NewSessionRequestParams;
import com.xiaohongshu.rdmind.acp.protocol.client.response.RequestPermissionResponse.RequestPermissionResponseResult;
import com.xiaohongshu.rdmind.acp.protocol.domain.permission.PermissionOutcomeKind;
import com.xiaohongshu.rdmind.acp.protocol.jsonrpc.MethodMessage;
import com.xiaohongshu.rdmind.acp.session.event.consumer.AgentEventConsumer;
import com.xiaohongshu.rdmind.acp.session.event.consumer.PermissionEventConsumer;
import com.xiaohongshu.rdmind.acp.session.event.consumer.exception.EventConsumeException;
import com.xiaohongshu.rdmind.acp.session.exception.SessionNewException;
import com.xiaohongshu.rdmind.acp.transport.Transport;
import com.xiaohongshu.rdmind.acp.transport.process.ProcessTransport;
import com.xiaohongshu.rdmind.acp.transport.process.ProcessTransportOptions;
import com.xiaohongshu.rdmind.acp.utils.Timeout;

import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import static com.xiaohongshu.rdmind.acp.protocol.domain.permission.PermissionOptionKind.ALLOW_ALWAYS;

class SessionTest {
    private static final Logger logger = LoggerFactory.getLogger(SessionTest.class);
    @Test
    public void testSession() throws AgentInitializeException, SessionNewException, IOException {
        RDMindAcpClient acpClient = new RDMindAcpClient(new ProcessTransport(new ProcessTransportOptions().setCommandArgs(new String[] {"rdmind", "--acp", "-y"})));
        try {
            acpClient.sendPrompt(Collections.singletonList(new TextContent("你是谁")), new AgentEventConsumer().setContentEventConsumer(new ContentEventSimpleConsumer(){
                @Override
                public void onAgentMessageChunkSessionUpdate(AgentMessageChunkSessionUpdate sessionUpdate) {
                    logger.info(sessionUpdate.toString());
                }

                @Override
                public void onAvailableCommandsUpdateSessionUpdate(AvailableCommandsUpdateSessionUpdate sessionUpdate) {
                    logger.info(sessionUpdate.toString());
                }

                @Override
                public void onCurrentModeUpdateSessionUpdate(CurrentModeUpdateSessionUpdate sessionUpdate) {
                    logger.info(sessionUpdate.toString());
                }

                @Override
                public void onPlanSessionUpdate(PlanSessionUpdate sessionUpdate) {
                    logger.info(sessionUpdate.toString());
                }

                @Override
                public void onToolCallUpdateSessionUpdate(ToolCallUpdateSessionUpdate sessionUpdate) {
                    logger.info(sessionUpdate.toString());
                }

                @Override
                public void onToolCallSessionUpdate(ToolCallSessionUpdate sessionUpdate) {
                    logger.info(sessionUpdate.toString());
                }
            }));
        } finally {
            acpClient.close();
        }
    }

    @Test
    void test() throws SessionNewException, AgentInitializeException, IOException {
        Transport transport = new ProcessTransport(
                new ProcessTransportOptions().setCommandArgs(new String[] {"rdmind", "--acp", "-y"}));
        RDMindAcpClient acpClient = new RDMindAcpClient(transport, new InitializeRequestParams().setClientCapabilities(
                new ClientCapabilities()
                        .setTerminal(true)
                        .setFs(new FileSystemCapability().setReadTextFile(true).setWriteTextFile(true))));
        Session session = acpClient.newSession(new NewSessionRequestParams());
        session.sendPrompt(Collections.singletonList(new TextContent("你是谁")), new AgentEventConsumer());
    }

    @Test
    void testPermission() throws AgentInitializeException, SessionNewException, IOException {
        Transport transport = new ProcessTransport(
                new ProcessTransportOptions().setCommandArgs(new String[] {"rdmind", "--acp"}));
        RDMindAcpClient acpClient = new RDMindAcpClient(transport, new InitializeRequestParams().setClientCapabilities(
                new ClientCapabilities()
                        .setTerminal(false)
                        .setFs(new FileSystemCapability(true, true))));
        Session session = acpClient.newSession(new NewSessionRequestParams());
        session.sendPrompt(Collections.singletonList(new TextContent("创建一个test.touch文件"))
                , new AgentEventConsumer().setFileEventConsumer(new FileEventSimpleConsumer()).setPermissionEventConsumer(new PermissionEventConsumer() {
                    @Override
                    public RequestPermissionResponseResult onRequestPermissionRequest(RequestPermissionRequest request) throws EventConsumeException {
                        return new RequestPermissionResponseResult(new RequestPermissionOutcome().
                                setOptionId(Optional.of(request)
                                        .map(MethodMessage::getParams)
                                        .map(RequestPermissionRequestParams::getOptions)
                                        .flatMap(options -> options.stream()
                                                .filter(option -> ALLOW_ALWAYS.equals(option.getKind()))
                                                .findFirst())
                                        .map(PermissionOption::getOptionId).orElse(null))
                                .setOutcome(PermissionOutcomeKind.SELECTED));
                    }

                    @Override
                    public Timeout onRequestPermissionRequestTimeout(RequestPermissionRequest request) {
                        return Timeout.TIMEOUT_60_SECONDS;
                    }
                }));
    }
}
